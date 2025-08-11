'use server';

import { hash } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { registerSchema } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { rateLimiters } from '@/lib/security/rateLimiter';

export interface RegisterState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  timestamp?: string;
}

/**
 * Server Action for user registration
 * 自動的にCSRF保護が適用される
 */
export async function registerAction(
  prevState: RegisterState | null,
  formData: FormData
): Promise<RegisterState> {
  const startTime = Date.now();
  
  try {
    // レート制限チェック
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    
    const rateLimitResult = await rateLimiters.auth.check({
      headers: headersList,
      nextUrl: { pathname: '/register' }
    } as Parameters<typeof rateLimiters.auth.check>[0]);
    
    if (!rateLimitResult.success) {
      logger.warn('Registration rate limit exceeded', { ip });
      return {
        success: false,
        error: '試行回数が多すぎます。しばらく待ってから再度お試しください。',
        timestamp: new Date().toISOString()
      };
    }
    
    // フォームデータの取得
    const email = formData.get('email') as string;
    const name = formData.get('username') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const terms = formData.get('terms') === 'on';
    
    // バリデーション
    const validationResult = registerSchema.safeParse({
      email,
      name,
      password,
      confirmPassword,
      terms
    });
    
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      
      validationResult.error.issues.forEach((error) => {
        const path = error.path.join('.');
        fieldErrors[path] = error.message;
      });
      
      logger.warn('Registration validation failed', { 
        email,
        errors: fieldErrors 
      });
      
      return {
        success: false,
        error: '入力内容を確認してください',
        fieldErrors,
        timestamp: new Date().toISOString()
      };
    }
    
    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: validationResult.data.email }
    });
    
    if (existingUser) {
      logger.warn('Registration attempted with existing email', { 
        email: validationResult.data.email 
      });
      
      return {
        success: false,
        fieldErrors: {
          email: 'このメールアドレスは既に登録されています'
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // ユーザー名の重複チェック
    const existingUsername = await prisma.user.findFirst({
      where: { 
        name: validationResult.data.name 
      }
    });
    
    if (existingUsername) {
      logger.warn('Registration attempted with existing username', { 
        name: validationResult.data.name 
      });
      
      return {
        success: false,
        fieldErrors: {
          name: 'このユーザー名は既に使用されています'
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // パスワードのハッシュ化
    const hashedPassword = await hash(validationResult.data.password, 12);
    
    // ユーザー作成（トランザクション使用）
    const user = await prisma.$transaction(async (tx) => {
      // ユーザー作成
      const newUser = await tx.user.create({
        data: {
          email: validationResult.data.email,
          username: validationResult.data.email,
          name: validationResult.data.name,
          password: hashedPassword,
          role: 'USER',
        }
      });
      
      // デフォルト設定を作成
      await tx.userSettings.create({
        data: {
          userId: newUser.id,
          theme: 'system'
        }
      });
      
      // 使用量制限を設定
      await tx.usageLimit.create({
        data: {
          userId: newUser.id,
          monthlyFileLimit: 5,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          currentMonthFiles: 0,
          resetDate: new Date(new Date().setDate(1)) // 月初
        }
      });
      
      return newUser;
    });
    
    logger.info('User registered successfully', { 
      userId: user.id,
      email: user.email,
      duration: Date.now() - startTime
    });
    
    // TODO: ウェルカムメールの送信
    // await sendWelcomeEmail(user.email, user.name);
    
    // TODO: メール確認リンクの送信
    // await sendEmailVerification(user.email, user.id);
    
  } catch (error) {
    // データベースエラー
    if (error instanceof Error && error.message.includes('prisma')) {
      const appError = new AppError(
        error.message,
        ErrorCodes.DATABASE_QUERY_FAILED,
        500,
        false,
        'ユーザー登録中にエラーが発生しました'
      );
      
      logger.logAppError(appError, { 
        duration: Date.now() - startTime 
      });
      
      return {
        success: false,
        error: 'ユーザー登録に失敗しました。しばらく待ってから再度お試しください。',
        timestamp: new Date().toISOString()
      };
    }
    
    // 予期しないエラー
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      '登録処理中に予期しないエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || '登録に失敗しました',
      timestamp: new Date().toISOString()
    };
  }
  
  // 成功時はログインページへリダイレクト
  redirect('/login?registered=true');
}

/**
 * メールアドレスの存在確認用Server Action
 * リアルタイムバリデーション用
 */
export async function checkEmailAvailability(email: string): Promise<{
  available: boolean;
  message?: string;
}> {
  try {
    // メールアドレスの形式チェック
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return {
        available: false,
        message: '有効なメールアドレスを入力してください'
      };
    }
    
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });
    
    if (existingUser) {
      return {
        available: false,
        message: 'このメールアドレスは既に登録されています'
      };
    }
    
    return {
      available: true
    };
  } catch (error) {
    logger.error('Email availability check error', error);
    return {
      available: false,
      message: '確認中にエラーが発生しました'
    };
  }
}

/**
 * ユーザー名の存在確認用Server Action
 * リアルタイムバリデーション用
 */
export async function checkUsernameAvailability(username: string): Promise<{
  available: boolean;
  message?: string;
}> {
  try {
    // ユーザー名の形式チェック
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return {
        available: false,
        message: 'ユーザー名は3〜30文字の英数字、ハイフン、アンダースコアのみ使用できます'
      };
    }
    
    const existingUser = await prisma.user.findFirst({
      where: { name: username },
      select: { id: true }
    });
    
    if (existingUser) {
      return {
        available: false,
        message: 'このユーザー名は既に使用されています'
      };
    }
    
    return {
      available: true
    };
  } catch (error) {
    logger.error('Username availability check error', error);
    return {
      available: false,
      message: '確認中にエラーが発生しました'
    };
  }
}
'use server';

import { redirect } from 'next/navigation';
import { loginSchema } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { headers } from 'next/headers';
import { checkServerActionRateLimit } from '@/lib/security/rateLimiter';
import prisma from '@/lib/prisma';
import { compare } from 'bcryptjs';
// Server Actionsではsignінを直接使用できないため削除

export interface LoginState {
  success: boolean;
  error?: string;
  timestamp?: string;
}

/**
 * Server Action for user login
 * 自動的にCSRF保護が適用される
 */
export async function loginAction(
  prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const startTime = Date.now();
  
  try {
    // レート制限チェック（Server Actions用の新しい実装）
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 
               headersList.get('x-real-ip') || 
               'unknown';
    
    const rateLimitResult = await checkServerActionRateLimit(
      ip,
      'login',
      {
        windowMs: 5 * 60 * 1000, // 5分
        max: 5 // 最大5回の試行
      }
    );
    
    if (!rateLimitResult.success) {
      logger.warn('Login rate limit exceeded', { ip });
      return {
        success: false,
        error: '試行回数が多すぎます。しばらく待ってから再度お試しください。',
        timestamp: new Date().toISOString()
      };
    }
    
    // フォームデータの取得
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const remember = formData.get('remember') === 'on';
    
    // バリデーション
    const validationResult = loginSchema.safeParse({ 
      email, 
      password,
      remember 
    });
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      logger.warn('Login validation failed', { 
        email,
        error: firstError.message 
      });
      
      return {
        success: false,
        error: firstError.message || '入力内容を確認してください',
        timestamp: new Date().toISOString()
      };
    }
    
    // データベースでユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email: validationResult.data.email }
    });
    
    if (!user) {
      logger.warn('Login failed - user not found', { 
        email,
        duration: Date.now() - startTime
      });
      
      return {
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません',
        timestamp: new Date().toISOString()
      };
    }
    
    // アカウントがアクティブか確認
    if (!user.isActive) {
      logger.warn('Login failed - account locked', { 
        email,
        userId: user.id,
        duration: Date.now() - startTime
      });
      
      return {
        success: false,
        error: 'アカウントがロックされています',
        timestamp: new Date().toISOString()
      };
    }
    
    // パスワードを検証
    const isPasswordValid = await compare(validationResult.data.password, user.passwordHash || '');
    
    if (!isPasswordValid) {
      logger.warn('Login failed - invalid password', { 
        email,
        userId: user.id,
        duration: Date.now() - startTime
      });
      
      return {
        success: false,
        error: 'メールアドレスまたはパスワードが正しくありません',
        timestamp: new Date().toISOString()
      };
    }
    
    // 認証成功
    logger.info('Login successful', { 
      email,
      userId: user.id,
      duration: Date.now() - startTime
    });
    
    // 最終ログイン時刻を更新
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          email,
          remember
        }
      }
    });
    
    // 成功を返す（クライアント側でsignInを実行）
    return {
      success: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    // 予期しないエラー
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      'ログイン処理中に予期しないエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || 'ログインに失敗しました',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * ログアウト用のServer Action
 */
export async function logoutAction(): Promise<void> {
  try {
    // TODO: セッション情報をクリア
    // Server Actionsではクッキーに直接アクセスできないため、
    // クライアント側でsignOutを呼ぶ必要がある
    
    logger.info('User logged out');
  } catch (error) {
    logger.error('Logout error', error);
    throw new AppError(
      'Logout failed',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      'ログアウトに失敗しました'
    );
  }
  
  // ログインページへリダイレクト
  redirect('/login');
}

/**
 * セッション確認用のServer Action
 */
export async function checkSessionAction(): Promise<{
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}> {
  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/lib/auth');
    
    const session = await getServerSession(authOptions);
    
    if (session?.user) {
      return {
        isAuthenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.name || '',
          role: session.user.role || 'USER'
        }
      };
    }
    
    return {
      isAuthenticated: false
    };
  } catch (error) {
    logger.error('Session check error', error);
    return {
      isAuthenticated: false
    };
  }
}
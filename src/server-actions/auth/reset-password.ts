'use server';

import { hash, compare } from 'bcryptjs';
import { redirect } from 'next/navigation';
import { resetPasswordSchema, changePasswordSchema } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { headers } from 'next/headers';
import { rateLimiters } from '@/lib/security/rateLimiter';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface ResetPasswordState {
  success: boolean;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ChangePasswordState {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  timestamp?: string;
}

/**
 * パスワードリセットリクエスト用Server Action
 * メールアドレスにリセットリンクを送信
 */
export async function requestPasswordResetAction(
  prevState: ResetPasswordState | null,
  formData: FormData
): Promise<ResetPasswordState> {
  const startTime = Date.now();
  
  try {
    // レート制限チェック（より厳しい制限）
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    
    const rateLimitResult = await rateLimiters.auth.check({
      headers: headersList,
      nextUrl: { pathname: '/reset-password' }
    } as Parameters<typeof rateLimiters.auth.check>[0]);
    
    if (!rateLimitResult.success) {
      logger.warn('Password reset rate limit exceeded', { ip });
      return {
        success: false,
        error: '試行回数が多すぎます。しばらく待ってから再度お試しください。',
        timestamp: new Date().toISOString()
      };
    }
    
    // フォームデータの取得
    const email = formData.get('email') as string;
    
    // バリデーション
    const validationResult = resetPasswordSchema.safeParse({ email });
    
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return {
        success: false,
        error: firstError.message || '有効なメールアドレスを入力してください',
        timestamp: new Date().toISOString()
      };
    }
    
    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { email: validationResult.data.email },
      select: { 
        id: true, 
        email: true, 
        name: true,
 
      }
    });
    
    // セキュリティのため、ユーザーが存在しない場合でも成功を返す
    if (!user) {
      logger.warn('Password reset requested for non-existent email', { 
        email: validationResult.data.email 
      });
      
      return {
        success: true,
        message: 'メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。',
        timestamp: new Date().toISOString()
      };
    }
    
    // リセットトークンの生成
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1時間後
    
    // TODO: passwordResetTokenモデルを追加するか、Sessionモデルを使用してトークンを保存
    // 現在はSessionモデルを使用
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: resetToken,
        expires: resetTokenExpiry
      }
    });
    
    // TODO: メール送信処理
    // const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/${resetToken}`;
    // await sendPasswordResetEmail(user.email, user.name, resetUrl);
    
    logger.info('Password reset token created', { 
      userId: user.id,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      message: 'メールアドレスが登録されている場合、パスワードリセットリンクを送信しました。',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      'パスワードリセット処理中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || 'リクエストの処理に失敗しました',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * パスワードリセット実行用Server Action
 * トークンを検証して新しいパスワードを設定
 */
export async function resetPasswordWithTokenAction(
  token: string,
  prevState: ResetPasswordState | null,
  formData: FormData
): Promise<ResetPasswordState> {
  const startTime = Date.now();
  
  try {
    // トークンの検証
    const resetToken = await prisma.session.findFirst({
      where: {
        sessionToken: token,
        expires: {
          gt: new Date()
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });
    
    if (!resetToken) {
      logger.warn('Invalid or expired password reset token', { token });
      return {
        success: false,
        error: 'リセットリンクが無効または期限切れです。もう一度リセットをリクエストしてください。',
        timestamp: new Date().toISOString()
      };
    }
    
    // フォームデータの取得
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    // バリデーション
    const validationResult = changePasswordSchema.safeParse({
      currentPassword: 'dummy', // リセット時は不要
      newPassword: password,
      confirmPassword
    });
    
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((error) => {
        const path = error.path.join('.');
        if (path !== 'currentPassword') {
          fieldErrors[path] = error.message;
        }
      });
      
      return {
        success: false,
        error: '入力内容を確認してください',
        timestamp: new Date().toISOString()
      };
    }
    
    // パスワードのハッシュ化
    const hashedPassword = await hash(password, 12);
    
    // トランザクションでパスワード更新とトークン無効化
    await prisma.$transaction(async (tx) => {
      // パスワード更新
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { 
          password: hashedPassword,
          updatedAt: new Date()
        }
      });
      
      // トークンを削除
      await tx.session.delete({
        where: { id: resetToken.id }
      });
      
      // 他の古いセッションも削除
      await tx.session.deleteMany({
        where: {
          userId: resetToken.userId,
          expires: {
            lt: new Date()
          }
        }
      });
    });
    
    logger.info('Password reset successful', { 
      userId: resetToken.userId,
      duration: Date.now() - startTime
    });
    
    // TODO: パスワード変更通知メールの送信
    // await sendPasswordChangedEmail(resetToken.user.email);
    
  } catch (error) {
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      'パスワードリセット処理中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || 'パスワードのリセットに失敗しました',
      timestamp: new Date().toISOString()
    };
  }
  
  // 成功時はログインページへリダイレクト
  redirect('/login?reset=true');
}

/**
 * パスワード変更用Server Action（ログイン済みユーザー用）
 */
export async function changePasswordAction(
  prevState: ChangePasswordState | null,
  formData: FormData
): Promise<ChangePasswordState> {
  const startTime = Date.now();
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'ログインが必要です',
        timestamp: new Date().toISOString()
      };
    }
    
    // フォームデータの取得
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    // バリデーション
    const validationResult = changePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      confirmPassword
    });
    
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((error) => {
        const path = error.path.join('.');
        fieldErrors[path] = error.message;
      });
      
      return {
        success: false,
        error: '入力内容を確認してください',
        fieldErrors,
        timestamp: new Date().toISOString()
      };
    }
    
    // 現在のパスワードを確認
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true }
    });
    
    if (!user?.password) {
      return {
        success: false,
        error: 'ユーザー情報の取得に失敗しました',
        timestamp: new Date().toISOString()
      };
    }
    
    const isPasswordValid = await compare(currentPassword, user.password);
    
    if (!isPasswordValid) {
      return {
        success: false,
        fieldErrors: {
          currentPassword: '現在のパスワードが正しくありません'
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // 新しいパスワードをハッシュ化
    const hashedPassword = await hash(newPassword, 12);
    
    // パスワード更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    });
    
    logger.info('Password changed successfully', { 
      userId: session.user.id,
      duration: Date.now() - startTime
    });
    
    // TODO: パスワード変更通知メールの送信
    // await sendPasswordChangedEmail(session.user.email);
    
    return {
      success: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      500,
      false,
      'パスワード変更処理中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || 'パスワードの変更に失敗しました',
      timestamp: new Date().toISOString()
    };
  }
}
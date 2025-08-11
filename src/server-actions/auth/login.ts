'use server';

import { redirect } from 'next/navigation';
import { loginSchema } from '@/lib/validation/schemas';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { headers } from 'next/headers';
import { rateLimiters } from '@/lib/security/rateLimiter';
import prisma from '@/lib/prisma';
import { compare } from 'bcryptjs';
import { signIn } from '@/lib/auth-client';

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
    // レート制限チェック
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') || 'unknown';
    
    const rateLimitResult = await rateLimiters.auth.check({
      headers: headersList,
      nextUrl: { pathname: '/login' }
    } as Parameters<typeof rateLimiters.auth.check>[0]);
    
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
    
    // 認証処理
    const result = await signIn('credentials', {
      email: validationResult.data.email,
      password: validationResult.data.password,
      redirect: false,
    });
    
    if (result?.error) {
      // 認証失敗
      logger.warn('Login failed', { 
        email,
        error: result.error,
        duration: Date.now() - startTime
      });
      
      let errorMessage = 'ログインに失敗しました';
      
      if (result.error === 'CredentialsSignin') {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません';
      } else if (result.error === 'AccessDenied') {
        errorMessage = 'アカウントがロックされています';
      }
      
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
    
    // 認証成功
    logger.info('Login successful', { 
      email,
      duration: Date.now() - startTime
    });
    
    // セッション情報を設定
    if (remember) {
      // Remember Me機能の実装
      // セッションの有効期限を延長
    }
    
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
  
  // 成功時はリダイレクト
  redirect('/');
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
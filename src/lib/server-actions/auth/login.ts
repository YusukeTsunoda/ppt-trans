'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { ServerActionState } from '../types';

export interface LoginResult {
  userId: string;
  email: string;
  name: string;
  role: string;
}

/**
 * ログイン Server Action
 */
export async function loginAction(
  prevState: ServerActionState<LoginResult>,
  formData: FormData
): Promise<ServerActionState<LoginResult>> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const rememberMe = formData.get('rememberMe') === 'on';

    // バリデーション
    if (!email || !password) {
      return {
        success: false,
        message: 'メールアドレスとパスワードを入力してください',
        
      };
    }

    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: '有効なメールアドレスを入力してください',
        
      };
    }

    // ユーザー検索
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return {
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません',
        
      };
    }

    // パスワード検証
    const isValidPassword = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!isValidPassword) {
      // ログイン失敗時の処理
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return {
        success: false,
        message: 'メールアドレスまたはパスワードが正しくありません',
        
      };
    }

    // アカウント有効性チェック
    if (!user.isActive) {
      return {
        success: false,
        message: 'アカウントが無効化されています。管理者にお問い合わせください。',
        
      };
    }

    // ログイン成功時の処理
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      rememberMe,
    });

    // TODO: NextAuthのセッション作成処理をここに実装
    // 現在はモック実装

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
      message: 'ログインしました',
      
    };
  } catch (error) {
    logger.error('Login error', error);
    return {
      success: false,
      message: 'ログイン処理中にエラーが発生しました',
      
    };
  }
}

/**
 * ソーシャルログイン Server Action
 */
export async function socialLoginAction(
  prevState: ServerActionState<LoginResult>,
  formData: FormData
): Promise<ServerActionState<LoginResult>> {
  try {
    const provider = formData.get('provider') as string;

    if (!provider || !['google', 'github'].includes(provider)) {
      return {
        success: false,
        message: '無効なプロバイダーです',
        
      };
    }

    // TODO: ソーシャルログインの実装
    logger.info('Social login attempt', { provider });

    return {
      success: false,
      message: 'ソーシャルログインは現在準備中です',
      
    };
  } catch (error) {
    logger.error('Social login error', error);
    return {
      success: false,
      message: 'ソーシャルログイン処理中にエラーが発生しました',
      
    };
  }
}

/**
 * ログアウト Server Action
 */
export async function logoutAction(
  prevState: ServerActionState<void>,
  formData: FormData
): Promise<ServerActionState<void>> {
  try {
    // TODO: NextAuthのセッション削除処理をここに実装
    logger.info('User logged out');

    return {
      success: true,
      message: 'ログアウトしました',
      
    };
  } catch (error) {
    logger.error('Logout error', error);
    return {
      success: false,
      message: 'ログアウト処理中にエラーが発生しました',
      
    };
  }
}
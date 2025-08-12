'use server';

// import { z } from 'zod'; // 現在未使用
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { ServerActionState } from '../types';

export interface RegisterResult {
  userId: string;
  email: string;
  name: string;
}

/**
 * 新規登録 Server Action
 */
export async function registerAction(
  prevState: ServerActionState<RegisterResult>,
  formData: FormData
): Promise<ServerActionState<RegisterResult>> {
  try {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    const acceptTerms = formData.get('acceptTerms') === 'on';

    // バリデーション
    if (!name || !email || !password || !confirmPassword) {
      return {
        success: false,
        message: 'すべての必須項目を入力してください',
        
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

    // パスワードの強度チェック
    if (password.length < 8) {
      return {
        success: false,
        message: 'パスワードは8文字以上で入力してください',
        
      };
    }

    // パスワード確認
    if (password !== confirmPassword) {
      return {
        success: false,
        message: 'パスワードが一致しません',
        
      };
    }

    // 利用規約の同意確認
    if (!acceptTerms) {
      return {
        success: false,
        message: '利用規約に同意してください',
        
      };
    }

    // 既存ユーザーのチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        message: 'このメールアドレスは既に登録されています',
        
      };
    }

    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username: email.split('@')[0], // メールアドレスからユーザー名を生成
        role: 'USER',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    logger.info('New user registered', {
      userId: user.id,
      email: user.email,
    });

    // TODO: 確認メール送信処理を実装

    return {
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        name: user.name || '',
      },
      message: '登録が完了しました',
      
    };
  } catch (error) {
    logger.error('Registration error', error);
    return {
      success: false,
      message: '登録処理中にエラーが発生しました',
      
    };
  }
}

/**
 * メールアドレス確認 Server Action
 */
export async function verifyEmailAction(
  prevState: ServerActionState<void>,
  formData: FormData
): Promise<ServerActionState<void>> {
  try {
    const token = formData.get('token') as string;

    if (!token) {
      return {
        success: false,
        message: '無効なトークンです',
        
      };
    }

    // TODO: トークン検証とメール確認処理を実装

    return {
      success: true,
      message: 'メールアドレスが確認されました',
      
    };
  } catch (error) {
    logger.error('Email verification error', error);
    return {
      success: false,
      message: 'メール確認処理中にエラーが発生しました',
      
    };
  }
}
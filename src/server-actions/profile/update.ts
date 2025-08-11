'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// プロファイル更新のスキーマ
const updateProfileSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100, '名前は100文字以内で入力してください').optional(),
  email: z.string().email('有効なメールアドレスを入力してください').optional(),
  bio: z.string().max(500, '自己紹介は500文字以内で入力してください').optional(),
  company: z.string().max(100, '会社名は100文字以内で入力してください').optional(),
  position: z.string().max(100, '役職は100文字以内で入力してください').optional(),
  location: z.string().max(100, '所在地は100文字以内で入力してください').optional(),
  website: z.string().url('有効なURLを入力してください').optional().or(z.literal('')),
  twitter: z.string().max(50, 'Twitterユーザー名は50文字以内で入力してください').optional(),
  github: z.string().max(50, 'GitHubユーザー名は50文字以内で入力してください').optional(),
  linkedin: z.string().max(100, 'LinkedIn URLは100文字以内で入力してください').optional(),
});

// パスワード変更のスキーマ
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: z.string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'パスワードは大文字、小文字、数字を含む必要があります'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
});

// 通知設定のスキーマ
const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  browserNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
  translationUpdates: z.boolean().optional(),
});

/**
 * プロファイル情報を更新
 */
export async function updateProfile(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = Object.fromEntries(formData);
    
    // バリデーション
    const validatedData = updateProfileSchema.parse(data);

    // ユーザー情報を更新
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        company: true,
        position: true,
        location: true,
        website: true,
        twitter: true,
        github: true,
        linkedin: true,
        avatarUrl: true,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'profile',
        entityId: session.user.id,
        metadata: {
          updatedFields: Object.keys(validatedData),
        },
      },
    });

    logger.info('Profile updated successfully', {
      userId: session.user.id,
      updatedFields: Object.keys(validatedData),
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'プロファイルの更新に失敗しました',
      };
    }

    logger.error('Failed to update profile', error);
    return {
      success: false,
      error: 'プロファイルの更新に失敗しました',
    };
  }
}

/**
 * プロファイル画像をアップロード
 */
export async function uploadAvatar(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    const file = formData.get('avatar') as File;
    if (!file || !(file instanceof File)) {
      throw new AppError(
        'No file provided',
        ErrorCodes.VALIDATION_ERROR,
        400,
        true,
        'ファイルが選択されていません'
      );
    }

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      throw new AppError(
        'File too large',
        ErrorCodes.VALIDATION_ERROR,
        400,
        true,
        'ファイルサイズは5MB以下にしてください'
      );
    }

    // ファイルタイプチェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new AppError(
        'Invalid file type',
        ErrorCodes.VALIDATION_ERROR,
        400,
        true,
        '画像ファイル（JPEG, PNG, GIF, WebP）のみアップロード可能です'
      );
    }

    // ファイル名を生成
    const ext = file.name.split('.').pop();
    const fileName = `${session.user.id}-${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars');
    const filePath = join(uploadDir, fileName);

    // ファイルを保存
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 古いアバターを削除
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
      const oldFilePath = join(process.cwd(), 'public', user.avatarUrl);
      try {
        await unlink(oldFilePath);
      } catch (error) {
        logger.warn('Failed to delete old avatar', { error, path: oldFilePath });
      }
    }

    // データベースを更新
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        avatarUrl: `/uploads/avatars/${fileName}`,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'avatar',
        entityId: session.user.id,
        metadata: {
          fileName,
          fileSize: file.size,
          fileType: file.type,
        },
      },
    });

    logger.info('Avatar uploaded successfully', {
      userId: session.user.id,
      fileName,
      fileSize: file.size,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: updatedUser,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'アバターのアップロードに失敗しました',
      };
    }

    logger.error('Failed to upload avatar', error);
    return {
      success: false,
      error: 'アバターのアップロードに失敗しました',
    };
  }
}

/**
 * パスワードを変更
 */
export async function changePassword(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = Object.fromEntries(formData);
    
    // バリデーション
    const validatedData = changePasswordSchema.parse(data);

    // 現在のパスワードを確認
    const bcrypt = require('bcryptjs');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user?.password) {
      throw new AppError(
        'User has no password',
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        400,
        true,
        'パスワードが設定されていません'
      );
    }

    const isPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        'Invalid current password',
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        400,
        true,
        '現在のパスワードが正しくありません'
      );
    }

    // 新しいパスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

    // パスワードを更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'password',
        entityId: session.user.id,
        metadata: {
          action: 'password_changed',
        },
      },
    });

    logger.info('Password changed successfully', {
      userId: session.user.id,
    });

    return {
      success: true,
      message: 'パスワードを変更しました',
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'パスワードの変更に失敗しました',
      };
    }

    logger.error('Failed to change password', error);
    return {
      success: false,
      error: 'パスワードの変更に失敗しました',
    };
  }
}

/**
 * 通知設定を更新
 */
export async function updateNotificationSettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      emailNotifications: formData.get('emailNotifications') === 'true',
      browserNotifications: formData.get('browserNotifications') === 'true',
      marketingEmails: formData.get('marketingEmails') === 'true',
      securityAlerts: formData.get('securityAlerts') === 'true',
      translationUpdates: formData.get('translationUpdates') === 'true',
    };
    
    // バリデーション
    const validatedData = notificationSettingsSchema.parse(data);

    // 通知設定を更新または作成
    const notificationSettings = await prisma.notificationSettings.upsert({
      where: { userId: session.user.id },
      update: validatedData,
      create: {
        userId: session.user.id,
        ...validatedData,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'notification_settings',
        entityId: session.user.id,
        metadata: validatedData,
      },
    });

    logger.info('Notification settings updated successfully', {
      userId: session.user.id,
      settings: validatedData,
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/settings');

    return {
      success: true,
      data: notificationSettings,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '通知設定の更新に失敗しました',
      };
    }

    logger.error('Failed to update notification settings', error);
    return {
      success: false,
      error: '通知設定の更新に失敗しました',
    };
  }
}

/**
 * アカウントを削除
 */
export async function deleteAccount(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    const confirmText = formData.get('confirmText') as string;
    if (confirmText !== 'DELETE') {
      throw new AppError(
        'Invalid confirmation',
        ErrorCodes.VALIDATION_ERROR,
        400,
        true,
        '確認テキストが正しくありません'
      );
    }

    // ユーザーのデータを論理削除
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        email: `deleted_${session.user.id}_${session.user.email}`, // メールアドレスを変更して再登録可能にする
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'account',
        entityId: session.user.id,
        metadata: {
          action: 'account_deleted',
        },
      },
    });

    logger.info('Account deleted successfully', {
      userId: session.user.id,
    });

    return {
      success: true,
      message: 'アカウントを削除しました',
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'アカウントの削除に失敗しました',
      };
    }

    logger.error('Failed to delete account', error);
    return {
      success: false,
      error: 'アカウントの削除に失敗しました',
    };
  }
}
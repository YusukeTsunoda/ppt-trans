'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function getProfile() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            files: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: 'ユーザーが見つかりません',
      };
    }

    // 統計情報を取得
    const [totalFiles, fileStats] = await Promise.all([
      prisma.file.count({
        where: { userId: session.user.id },
      }),
      prisma.file.aggregate({
        where: { userId: session.user.id },
        _sum: {
          fileSize: true,
        },
      }),
    ]);

    // デフォルト設定（実際の設定テーブルがない場合）
    const settings = {
      translationModel: 'claude-3-haiku-20240307',
      targetLanguage: 'Japanese',
      batchSize: 5,
      autoSave: true,
      theme: 'light',
    };

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        settings,
        stats: {
          totalFiles,
          totalTranslations: totalFiles, // 仮の値
          totalSlides: 0, // スライド数の取得は別途実装が必要
          storageUsed: fileStats._sum.fileSize || 0,
        },
      },
    };
  } catch (error) {
    console.error('プロファイル取得エラー:', error);
    return {
      success: false,
      error: 'プロファイルの取得に失敗しました',
    };
  }
}

export async function updateProfileSettings(settings: {
  translationModel?: string;
  targetLanguage?: string;
  batchSize?: number;
  autoSave?: boolean;
  theme?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です',
      };
    }

    // 設定を保存する処理（実際の設定テーブルがない場合は仮実装）
    // await prisma.userSettings.update({
    //   where: { userId: session.user.id },
    //   data: settings,
    // });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SETTINGS_UPDATE',
        entityType: 'profile_settings',
        entityId: session.user.id,
        metadata: settings,
      },
    });

    return {
      success: true,
      message: '設定を保存しました',
    };
  } catch (error) {
    console.error('設定更新エラー:', error);
    return {
      success: false,
      error: '設定の保存に失敗しました',
    };
  }
}
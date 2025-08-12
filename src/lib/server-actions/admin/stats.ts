'use server';

import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * ダッシュボード統計情報を取得
 */
export async function getDashboardStats() {
  try {
    const [
      totalUsers,
      activeUsers,
      totalFiles,
      totalTranslations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.file.count(),
      prisma.translation.count(),
    ]);

    return {
      success: true,
      data: {
        totalUsers,
        activeUsers,
        totalFiles,
        totalTranslations,
      },
    };
  } catch (error) {
    logger.error('Get dashboard stats error', error);
    return {
      success: false,
      message: '統計情報の取得中にエラーが発生しました',
    };
  }
}

/**
 * 監査ログを取得
 */
export async function getAuditLogs() {
  try {
    const logs = await prisma.activityLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    return {
      success: true,
      data: { logs },
    };
  } catch (error) {
    logger.error('Get audit logs error', error);
    return {
      success: false,
      message: '監査ログの取得中にエラーが発生しました',
    };
  }
}

/**
 * ユーザー統計情報を取得
 */
export const getUserStats = getDashboardStats;

/**
 * ファイル統計情報を取得
 */
export const getFileStats = getDashboardStats;
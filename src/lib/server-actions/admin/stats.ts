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

    // 30日前のデータを取得して成長率を計算
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [
      previousUsers,
      previousFiles,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
      prisma.file.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
    ]);

    const userGrowthRate = previousUsers > 0 
      ? Math.round(((totalUsers - previousUsers) / previousUsers) * 100)
      : 0;
    
    const fileGrowthRate = previousFiles > 0
      ? Math.round(((totalFiles - previousFiles) / previousFiles) * 100)
      : 0;

    return {
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          userGrowthRate,
        },
        files: {
          totalFiles,
          fileGrowthRate,
        },
        usage: {
          totalTranslations,
        },
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
'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, subDays, subMonths } from 'date-fns';

// 期間のスキーマ
const periodSchema = z.enum(['day', 'week', 'month', 'quarter', 'year', 'all']);

// 統計取得のスキーマ
const getStatsSchema = z.object({
  period: periodSchema.default('month'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * 管理者権限をチェック
 */
async function checkAdminPermission() {
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    throw new AppError(
      'Forbidden',
      ErrorCodes.AUTH_UNAUTHORIZED,
      403,
      true,
      '管理者権限が必要です'
    );
  }

  return session.user.id;
}

/**
 * 期間の開始日と終了日を取得
 */
function getDateRange(period: z.infer<typeof periodSchema>, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (customStart && customEnd) {
    return {
      startDate: new Date(customStart),
      endDate: new Date(customEnd),
    };
  }

  switch (period) {
    case 'day':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'month':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'quarter':
      startDate = subMonths(now, 3);
      break;
    case 'year':
      startDate = subMonths(now, 12);
      break;
    case 'all':
      startDate = new Date('2020-01-01');
      break;
    default:
      startDate = startOfMonth(now);
  }

  return { startDate, endDate };
}

/**
 * ダッシュボード統計を取得
 */
export async function getDashboardStats(params?: z.infer<typeof getStatsSchema>) {
  try {
    const adminUserId = await checkAdminPermission();

    // パラメータをバリデーション
    const validatedParams = params ? getStatsSchema.parse(params) : { period: 'month' as const };
    const { startDate, endDate } = getDateRange(
      validatedParams.period,
      validatedParams.startDate,
      validatedParams.endDate
    );

    // 並列でデータを取得
    const [
      totalUsers,
      activeUsers,
      newUsers,
      totalFiles,
      processedFiles,
      totalTranslations,
      storageUsed,
      apiUsage,
    ] = await Promise.all([
      // 総ユーザー数
      prisma.user.count(),

      // アクティブユーザー数（期間内にログインしたユーザー）
      prisma.user.count({
        where: {
                    lastLoginAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // 新規ユーザー数
      prisma.user.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // 総ファイル数
      prisma.file.count(),

      // 処理済みファイル数
      prisma.file.count({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // 翻訳数（仮のテーブル名）
      prisma.file.count({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // ストレージ使用量
      prisma.file.aggregate({
        _sum: {
          fileSize: true,
        },
      }),

      // API使用量（監査ログから集計）
      prisma.auditLog.count({
        where: {
          action: 'FILE_TRANSLATE',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
    ]);

    // 成長率を計算
    const previousPeriod = {
      startDate: subDays(startDate, endDate.getTime() - startDate.getTime()),
      endDate: startDate,
    };

    const [previousNewUsers, previousFiles] = await Promise.all([
      prisma.user.count({
        where: {
          createdAt: {
            gte: previousPeriod.startDate,
            lt: previousPeriod.endDate,
          },
        },
      }),
      prisma.file.count({
        where: {
          createdAt: {
            gte: previousPeriod.startDate,
            lt: previousPeriod.endDate,
          },
        },
      }),
    ]);

    const userGrowthRate = previousNewUsers > 0
      ? ((newUsers - previousNewUsers) / previousNewUsers) * 100
      : 0;

    const fileGrowthRate = previousFiles > 0
      ? ((processedFiles - previousFiles) / previousFiles) * 100
      : 0;

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'dashboard_stats',
        entityId: 'stats',
        metadata: {
          period: validatedParams.period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });

    logger.info('Dashboard stats retrieved', {
      adminUserId,
      period: validatedParams.period,
    });

    return {
      success: true,
      data: {
        overview: {
          totalUsers,
          activeUsers,
          newUsers,
          userGrowthRate: Math.round(userGrowthRate * 10) / 10,
        },
        files: {
          totalFiles,
          processedFiles,
          fileGrowthRate: Math.round(fileGrowthRate * 10) / 10,
        },
        usage: {
          totalTranslations,
          storageUsed: storageUsed._sum.fileSize || 0,
          apiUsage,
        },
        period: {
          label: validatedParams.period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '統計情報の取得に失敗しました',
      };
    }

    logger.error('Failed to get dashboard stats', error);
    return {
      success: false,
      error: '統計情報の取得に失敗しました',
    };
  }
}

/**
 * ユーザー統計の詳細を取得
 */
export async function getUserStats(params?: z.infer<typeof getStatsSchema>) {
  try {
    const adminUserId = await checkAdminPermission();

    const validatedParams = params ? getStatsSchema.parse(params) : { period: 'month' as const };
    const { startDate, endDate } = getDateRange(
      validatedParams.period,
      validatedParams.startDate,
      validatedParams.endDate
    );

    // ユーザー統計を取得
    const [
      usersByRole,
      usersByStatus,
      topActiveUsers,
      registrationTrend,
    ] = await Promise.all([
      // 役割別ユーザー数
      prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),

      // ステータス別ユーザー数
      prisma.user.groupBy({
        by: ['isActive'],
        _count: true,
      }),

      // 最もアクティブなユーザー
      prisma.user.findMany({
        where: {
                    lastLoginAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          _count: {
            select: {
              files: true,
              auditLogs: true,
            },
          },
        },
        orderBy: {
          files: {
            _count: 'desc',
          },
        },
        take: 10,
      }),

      // 登録トレンド（日別）
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ]);

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'user_stats',
        entityId: 'stats',
        metadata: {
          period: validatedParams.period,
        },
      },
    });

    logger.info('User stats retrieved', {
      adminUserId,
      period: validatedParams.period,
    });

    return {
      success: true,
      data: {
        byRole: usersByRole,
        byStatus: usersByStatus,
        topActiveUsers,
        registrationTrend,
        period: {
          label: validatedParams.period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ユーザー統計の取得に失敗しました',
      };
    }

    logger.error('Failed to get user stats', error);
    return {
      success: false,
      error: 'ユーザー統計の取得に失敗しました',
    };
  }
}

/**
 * ファイル統計の詳細を取得
 */
export async function getFileStats(params?: z.infer<typeof getStatsSchema>) {
  try {
    const adminUserId = await checkAdminPermission();

    const validatedParams = params ? getStatsSchema.parse(params) : { period: 'month' as const };
    const { startDate, endDate } = getDateRange(
      validatedParams.period,
      validatedParams.startDate,
      validatedParams.endDate
    );

    // ファイル統計を取得
    const [
      filesByStatus,
      filesByType,
      processingTrend,
      largestFiles,
    ] = await Promise.all([
      // ステータス別ファイル数
      prisma.file.groupBy({
        by: ['status'],
        _count: true,
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // ファイルタイプ別
      prisma.file.groupBy({
        by: ['mimeType'],
        _count: true,
        _sum: {
          fileSize: true,
        },
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // 処理トレンド（日別）
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM files
        WHERE created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,

      // 最大ファイル
      prisma.file.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          status: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          fileSize: 'desc',
        },
        take: 10,
      }),
    ]);

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'file_stats',
        entityId: 'stats',
        metadata: {
          period: validatedParams.period,
        },
      },
    });

    logger.info('File stats retrieved', {
      adminUserId,
      period: validatedParams.period,
    });

    return {
      success: true,
      data: {
        byStatus: filesByStatus,
        byType: filesByType,
        processingTrend,
        largestFiles,
        averageProcessingTime: 0, // processingTime field doesn't exist
        period: {
          label: validatedParams.period,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ファイル統計の取得に失敗しました',
      };
    }

    logger.error('Failed to get file stats', error);
    return {
      success: false,
      error: 'ファイル統計の取得に失敗しました',
    };
  }
}

/**
 * システム統計を取得
 */
export async function getSystemStats() {
  try {
    const adminUserId = await checkAdminPermission();

    // システム統計を取得
    const [
      databaseSize,
      sessionCount,
      auditLogCount,
      errorRate,
      apiHealth,
    ] = await Promise.all([
      // データベースサイズ（テーブル数）
      prisma.$queryRaw`
        SELECT 
          COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
      `,

      // アクティブセッション数
      prisma.session.count({
        where: {
          expires: {
            gt: new Date(),
          },
        },
      }),

      // 監査ログ数
      prisma.auditLog.count(),

      // エラー率（直近24時間）
      prisma.auditLog.count({
        where: {
          action: 'LOGIN',
          createdAt: {
            gte: subDays(new Date(), 1),
          },
        },
      }),

      // API健全性（仮のチェック）
      Promise.resolve({
        anthropic: 'healthy',
        database: 'healthy',
        storage: 'healthy',
      }),
    ]);

    // システム情報
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'system_stats',
        entityId: 'stats',
        metadata: {},
      },
    });

    logger.info('System stats retrieved', {
      adminUserId,
    });

    return {
      success: true,
      data: {
        database: {
          tableCount: (databaseSize as any)[0]?.table_count || 0,
          sessionCount,
          auditLogCount,
        },
        health: {
          errorRate,
          apiHealth,
        },
        system: systemInfo,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'システム統計の取得に失敗しました',
      };
    }

    logger.error('Failed to get system stats', error);
    return {
      success: false,
      error: 'システム統計の取得に失敗しました',
    };
  }
}

/**
 * 監査ログを取得
 */
export async function getAuditLogs(params: {
  userId?: string;
  action?: string;
  entityType?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const adminUserId = await checkAdminPermission();

    const {
      userId,
      action,
      entityType,
      page = 1,
      limit = 50,
    } = params;

    // 検索条件を構築
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    // ログを取得
    const [logs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATE',
        entityType: 'audit_logs',
        entityId: 'list',
        metadata: params,
      },
    });

    logger.info('Audit logs retrieved', {
      adminUserId,
      params,
    });

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '監査ログの取得に失敗しました',
      };
    }

    logger.error('Failed to get audit logs', error);
    return {
      success: false,
      error: '監査ログの取得に失敗しました',
    };
  }
}

/**
 * エクスポート用データを生成
 */
export async function exportStats(format: 'csv' | 'json' | 'pdf') {
  try {
    const adminUserId = await checkAdminPermission();

    // 統計データを取得
    const [dashboardStats, userStats, fileStats] = await Promise.all([
      getDashboardStats(),
      getUserStats(),
      getFileStats(),
    ]);

    const data = {
      exportDate: new Date().toISOString(),
      dashboard: dashboardStats.data,
      users: userStats.data,
      files: fileStats.data,
    };

    let exportData: string | Buffer;

    switch (format) {
      case 'json':
        exportData = JSON.stringify(data, null, 2);
        break;
      case 'csv':
        // CSV変換（簡易実装）
        exportData = 'Type,Metric,Value\n';
        exportData += `Users,Total,${data.dashboard?.overview.totalUsers}\n`;
        exportData += `Users,Active,${data.dashboard?.overview.activeUsers}\n`;
        exportData += `Files,Total,${data.dashboard?.files.totalFiles}\n`;
        break;
      case 'pdf':
        // PDF生成（実装は省略）
        exportData = Buffer.from('PDF content would be here');
        break;
      default:
        throw new Error('Unsupported format');
    }

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FILE_DOWNLOAD',
        entityType: 'stats',
        entityId: 'all',
        metadata: { format },
      },
    });

    logger.info('Stats exported', {
      adminUserId,
      format,
    });

    return {
      success: true,
      data: exportData,
      mimeType: format === 'json' ? 'application/json' :
                format === 'csv' ? 'text/csv' :
                'application/pdf',
      fileName: `stats_${new Date().toISOString().split('T')[0]}.${format}`,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || '統計のエクスポートに失敗しました',
      };
    }

    logger.error('Failed to export stats', error);
    return {
      success: false,
      error: '統計のエクスポートに失敗しました',
    };
  }
}
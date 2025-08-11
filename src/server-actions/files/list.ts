'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import type { File, Translation } from '@prisma/client';

export interface FileWithTranslations extends File {
  translations: Translation[];
  _count?: {
    translations: number;
  };
}

export interface FileListState {
  success: boolean;
  error?: string;
  files?: FileWithTranslations[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

export interface FileListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'fileName' | 'fileSize';
  sortOrder?: 'asc' | 'desc';
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  search?: string;
  userId?: string; // Admin用のオプション
}

/**
 * ファイル一覧を取得するServer Action
 * 自動的にCSRF保護が適用される
 */
export async function listFilesAction(
  options: FileListOptions = {}
): Promise<FileListState> {
  const startTime = Date.now();
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // オプションのデフォルト値設定
    const {
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      search
    } = options;
    
    // ページネーション計算
    const skip = (page - 1) * pageSize;
    
    // 検索条件構築
    const where: Record<string, unknown> = {
      userId: session.user.id
    };
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.fileName = {
        contains: search,
        mode: 'insensitive'
      };
    }
    
    // Admin権限の場合は全ユーザーのファイルを取得可能
    if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
      delete where.userId;
      
      // Admin向けのフィルタオプション
      if (options.userId) {
        where.userId = options.userId;
      }
    }
    
    // データ取得
    const [files, totalCount] = await prisma.$transaction([
      prisma.file.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          translations: {
            select: {
              id: true,
              fileId: true,
              targetLanguage: true,
              status: true,
              progress: true,
              createdAt: true,
              completedAt: true,
              slideNumber: true,
              originalText: true,
              translatedText: true
            }
          },
          _count: {
            select: {
              translations: true
            }
          }
        }
      }),
      prisma.file.count({ where })
    ]);
    
    // 統計情報を計算
    const hasMore = skip + files.length < totalCount;
    
    logger.info('Files listed successfully', { 
      userId: session.user.id,
      filesCount: files.length,
      totalCount,
      page,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      files,
      totalCount,
      page,
      pageSize,
      hasMore
    };
    
  } catch (error) {
    logger.error('File listing error', error);
    
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.FILE_LIST_FAILED,
      500,
      false,
      'ファイル一覧の取得中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      userId: (await getServerSession(authOptions))?.user?.id,
      options,
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || '一覧の取得に失敗しました'
    };
  }
}

/**
 * ファイルの詳細情報を取得するServer Action
 */
export async function getFileDetailsAction(
  fileId: string
): Promise<{
  success: boolean;
  error?: string;
  file?: FileWithTranslations & {
    user?: {
      id: string;
      email: string;
      name: string | null;
    };
    activityLogs?: Array<{
      id: string;
      action: string;
      createdAt: Date;
      metadata: unknown;
    }>;
  };
}> {
  const startTime = Date.now();
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // ファイル取得
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        translations: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        activityLogs: {
          select: {
            id: true,
            action: true,
            createdAt: true,
            metadata: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });
    
    if (!file) {
      return {
        success: false,
        error: 'ファイルが見つかりません'
      };
    }
    
    // 権限チェック（所有者またはAdmin）
    if (file.userId !== session.user.id && session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      logger.warn('Unauthorized file access attempt', { 
        userId: session.user.id,
        fileId,
        ownerId: file.userId
      });
      
      return {
        success: false,
        error: 'このファイルにアクセスする権限がありません'
      };
    }
    
    logger.info('File details retrieved', { 
      userId: session.user.id,
      fileId,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      file
    };
    
  } catch (error) {
    logger.error('File details error', error);
    
    return {
      success: false,
      error: 'ファイル詳細の取得に失敗しました'
    };
  }
}

/**
 * ファイル統計を取得するServer Action
 */
export async function getFileStatisticsAction(): Promise<{
  success: boolean;
  error?: string;
  statistics?: {
    totalFiles: number;
    totalSize: number;
    filesByStatus: Record<string, number>;
    filesByMonth: Array<{ month: string; count: number }>;
    recentFiles: FileWithTranslations[];
    storageUsage: {
      used: number;
      limit: number;
      percentage: number;
    };
  };
}> {
  const startTime = Date.now();
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const userId = session.user.id;
    
    // 統計データ取得
    const [
      totalFiles,
      totalSizeResult,
      filesByStatus,
      recentFiles,
      usageLimit
    ] = await prisma.$transaction([
      // 総ファイル数
      prisma.file.count({
        where: { userId }
      }),
      
      // 総ファイルサイズ
      prisma.file.aggregate({
        where: { userId },
        _sum: { fileSize: true }
      }),
      
      // ステータス別ファイル数
      prisma.file.groupBy({
        by: ['status'],
        where: { userId },
        orderBy: { status: 'asc' },
        _count: true
      }),
      
      // 最近のファイル
      prisma.file.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          translations: true
        }
      }),
      
      // 使用量制限
      prisma.usageLimit.findUnique({
        where: { userId }
      })
    ]);
    
    // 月別ファイル数（直近6ヶ月）
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const filesByMonth = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
      SELECT 
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        COUNT(*) as count
      FROM "File"
      WHERE "userId" = ${userId}
        AND "createdAt" >= ${sixMonthsAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month DESC
    `;
    
    // データ整形
    const totalSize = totalSizeResult._sum.fileSize || 0;
    const statusMap = filesByStatus.reduce((acc, item) => {
      acc[item.status] = typeof item._count === 'number' ? item._count : (item._count === true ? 1 : 0);
      return acc;
    }, {} as Record<string, number>);
    
    const storageLimit = usageLimit?.maxStorageSize || 1073741824; // 1GB default
    const storageUsage = {
      used: totalSize,
      limit: storageLimit,
      percentage: Math.round((totalSize / storageLimit) * 100)
    };
    
    logger.info('File statistics retrieved', { 
      userId: session.user.id,
      totalFiles,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      statistics: {
        totalFiles,
        totalSize,
        filesByStatus: statusMap,
        filesByMonth: filesByMonth.map(item => ({
          month: item.month,
          count: Number(item.count)
        })),
        recentFiles,
        storageUsage
      }
    };
    
  } catch (error) {
    logger.error('File statistics error', error);
    
    return {
      success: false,
      error: '統計情報の取得に失敗しました'
    };
  }
}
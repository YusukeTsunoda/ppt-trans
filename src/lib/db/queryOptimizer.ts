import prisma from '@/lib/prisma';
import { getCacheManager } from '@/lib/cache/CacheManager';
import logger from '@/lib/logger';
import { Prisma } from '@prisma/client';

const cache = getCacheManager();

/**
 * クエリ最適化ヘルパー関数
 */
export class QueryOptimizer {
  /**
   * ユーザーと関連データを効率的に取得（N+1問題を回避）
   */
  static async getUserWithRelations(userId: string) {
    const cacheKey = `user:full:${userId}`;
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        return prisma.user.findUnique({
          where: { id: userId },
          include: {
            files: {
              orderBy: { createdAt: 'desc' },
              take: 10, // 最新10件のみ
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                status: true,
                createdAt: true,
              },
            },
            sessions: {
              where: {
                expires: { gt: new Date() },
              },
              take: 1,
              orderBy: { expires: 'desc' },
            },
            _count: {
              select: {
                files: true,
                sessions: true,
              },
            },
          },
        });
      },
      60 * 5 // 5分間キャッシュ
    );
  }

  /**
   * ファイル一覧を効率的に取得（ページネーション対応）
   */
  static async getFilesWithPagination(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;
    const cacheKey = `files:list:${userId}:${page}:${limit}`;
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const [files, total] = await Promise.all([
          prisma.file.findMany({
            where: { userId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              status: true,
              totalSlides: true,
              createdAt: true,
              updatedAt: true,
              // 重いフィールドは除外
              // fileUrl: false,
              // processedData: false,
            },
          }),
          prisma.file.count({ where: { userId } }),
        ]);

        return {
          files,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      60 * 2 // 2分間キャッシュ
    );
  }

  /**
   * 翻訳統計を効率的に取得
   */
  static async getTranslationStats(userId?: string) {
    const cacheKey = userId ? `stats:translation:${userId}` : 'stats:translation:all';
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const where = userId ? { userId } : {};
        
        // 集計クエリを並列実行
        const [totalFiles, recentActivity] = await Promise.all([
          prisma.file.count({ where }),
          prisma.file.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              fileName: true,
              status: true,
              createdAt: true,
            },
          }),
        ]);

        // 言語別の統計
        const languageStats = await prisma.file.groupBy({
          by: ['targetLanguage'],
          where,
          _count: { id: true },
        });

        return {
          totalFiles,
          totalTexts: 0,  // textCountフィールドが存在しないため0を返す
          languageStats,
          recentActivity,
        };
      },
      60 * 10 // 10分間キャッシュ
    );
  }

  /**
   * バッチ更新（トランザクション最適化）
   */
  static async batchUpdateFiles(
    updates: Array<{ id: string; data: Prisma.FileUpdateInput }>
  ) {
    try {
      // トランザクション内でバッチ更新
      const results = await prisma.$transaction(
        updates.map((update) =>
          prisma.file.update({
            where: { id: update.id },
            data: update.data,
          })
        )
      );

      // 関連するキャッシュをクリア
      for (const update of updates) {
        await cache.deletePattern(`*file:${update.id}*`);
      }

      logger.info(`Batch updated ${results.length} files`);
      return results;
    } catch (error) {
      logger.error('Batch update failed', error);
      throw error;
    }
  }

  /**
   * 効率的な検索（全文検索）
   */
  static async searchFiles(query: string, userId?: string) {
    const cacheKey = `search:files:${query}:${userId || 'all'}`;
    
    return cache.getOrSet(
      cacheKey,
      async () => {
        const where: Prisma.FileWhereInput = {
          AND: [
            userId ? { userId } : {},
            {
              OR: [
                { fileName: { contains: query } },
                // originalFileNameフィールドが存在しないためコメントアウト
                // { originalFileName: { contains: query, mode: 'insensitive' } },
                // processedDataに対する検索は重いので必要な場合のみ
                // { processedData: { path: ['texts'], array_contains: query } },
              ],
            },
          ],
        };

        return prisma.file.findMany({
          where,
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            status: true,
            createdAt: true,
          },
        });
      },
      60 * 5 // 5分間キャッシュ
    );
  }

  /**
   * データベース接続プールの状態を取得
   */
  static async getConnectionPoolStats() {
    try {
      // Prismaのメトリクスを取得
      // TODO: Prismaメトリクスを有効化する必要があります
      // const metrics = await prisma.$metrics.json();
      const metrics = {};
      return {
        metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to get connection pool stats', error);
      return null;
    }
  }

  /**
   * インデックスの使用状況を確認
   */
  static async analyzeQueryPerformance(query: string) {
    try {
      // PostgreSQLのEXPLAIN ANALYZEを実行
      const result = await prisma.$queryRawUnsafe(
        `EXPLAIN ANALYZE ${query}`
      );
      return result;
    } catch (error) {
      logger.error('Query analysis failed', error);
      return null;
    }
  }

  /**
   * 未使用セッションのクリーンアップ
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expires: { lt: new Date() },
        },
      });

      logger.info(`Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      logger.error('Session cleanup failed', error);
      return 0;
    }
  }

  /**
   * 古いファイルのアーカイブ
   */
  static async archiveOldFiles(daysOld: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.file.updateMany({
        where: {
          createdAt: { lt: cutoffDate },
          status: { not: 'COMPLETED' },
        },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date(),
        },
      });

      logger.info(`Archived ${result.count} old files`);
      return result.count;
    } catch (error) {
      logger.error('File archiving failed', error);
      return 0;
    }
  }
}

// データベース最適化スケジューラー
export class DatabaseMaintenanceScheduler {
  private intervals: NodeJS.Timeout[] = [];

  start() {
    // 1時間ごとに期限切れセッションをクリーンアップ
    this.intervals.push(
      setInterval(async () => {
        await QueryOptimizer.cleanupExpiredSessions();
      }, 60 * 60 * 1000)
    );

    // 24時間ごとに古いファイルをアーカイブ
    this.intervals.push(
      setInterval(async () => {
        await QueryOptimizer.archiveOldFiles();
      }, 24 * 60 * 60 * 1000)
    );

    logger.info('Database maintenance scheduler started');
  }

  stop() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    logger.info('Database maintenance scheduler stopped');
  }
}

// エクスポート
export const dbMaintenance = new DatabaseMaintenanceScheduler();
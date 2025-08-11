'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { readFile, stat, createReadStream } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import archiver from 'archiver';
import { Readable } from 'stream';

// ファイルダウンロードのスキーマ
const downloadFileSchema = z.object({
  fileId: z.string().uuid(),
  format: z.enum(['original', 'pdf', 'images', 'text']).default('original'),
  includeMetadata: z.boolean().default(false),
});

// バッチダウンロードのスキーマ
const batchDownloadSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(100),
  format: z.enum(['zip', 'tar']).default('zip'),
  includeMetadata: z.boolean().default(false),
});

// レジューマブルダウンロードのスキーマ
const resumableDownloadSchema = z.object({
  fileId: z.string().uuid(),
  range: z.string().optional(), // "bytes=0-1023"
  etag: z.string().optional(),
});

// ダウンロード統計のスキーマ
const downloadStatsSchema = z.object({
  fileId: z.string().uuid(),
  period: z.enum(['day', 'week', 'month', 'all']).default('month'),
});

/**
 * ファイルをダウンロード
 */
export async function downloadFile(params: z.infer<typeof downloadFileSchema>) {
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

    // バリデーション
    const validatedData = downloadFileSchema.parse(params);

    // ファイルの存在確認と権限チェック
    const file = await prisma.file.findUnique({
      where: { id: validatedData.fileId },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!file) {
      throw new AppError(
        'File not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // アクセス権限のチェック
    const isOwner = file.user.id === session.user.id;
    const isAdmin = file.user.role === 'ADMIN';
    const isPublic = file.isPublic;

    if (!isOwner && !isAdmin && !isPublic) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'このファイルへのアクセス権限がありません'
      );
    }

    // ファイルパスを構築
    const filePath = join(process.cwd(), 'public', file.filePath);

    // ファイルの存在確認
    try {
      await stat(filePath);
    } catch (error) {
      logger.error('File not found on disk', { filePath, error });
      throw new AppError(
        'File not found on disk',
        ErrorCodes.NOT_FOUND,
        404,
        false,
        'ファイルが見つかりません'
      );
    }

    // フォーマット変換が必要な場合
    let downloadPath = filePath;
    let mimeType = file.mimeType;
    let fileName = file.fileName;

    if (validatedData.format !== 'original') {
      // 変換処理（実装は省略）
      switch (validatedData.format) {
        case 'pdf':
          // PPTXをPDFに変換
          downloadPath = await convertToPdf(filePath);
          mimeType = 'application/pdf';
          fileName = fileName.replace(/\.[^.]+$/, '.pdf');
          break;
        case 'images':
          // PPTXを画像に変換
          downloadPath = await convertToImages(filePath);
          mimeType = 'application/zip';
          fileName = fileName.replace(/\.[^.]+$/, '_images.zip');
          break;
        case 'text':
          // テキストを抽出
          downloadPath = await extractText(filePath);
          mimeType = 'text/plain';
          fileName = fileName.replace(/\.[^.]+$/, '.txt');
          break;
      }
    }

    // ファイルを読み込む
    const fileBuffer = await readFile(downloadPath);

    // ETagを生成
    const etag = createHash('md5').update(fileBuffer).digest('hex');

    // ダウンロード履歴を記録
    await prisma.downloadHistory.create({
      data: {
        fileId: validatedData.fileId,
        userId: session.user.id,
        format: validatedData.format,
        fileSize: fileBuffer.length,
        ipAddress: '', // リクエストから取得
        userAgent: '', // リクエストから取得
      },
    });

    // ダウンロード数を更新
    await prisma.file.update({
      where: { id: validatedData.fileId },
      data: {
        downloadCount: {
          increment: 1,
        },
        lastDownloadAt: new Date(),
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DOWNLOAD',
        entityType: 'file',
        entityId: validatedData.fileId,
        metadata: {
          format: validatedData.format,
          fileSize: fileBuffer.length,
        },
      },
    });

    logger.info('File downloaded', {
      userId: session.user.id,
      fileId: validatedData.fileId,
      format: validatedData.format,
    });

    // メタデータを含める場合
    let metadata = {};
    if (validatedData.includeMetadata) {
      metadata = {
        id: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        downloadCount: file.downloadCount,
        metadata: file.metadata,
      };
    }

    return {
      success: true,
      data: {
        fileBuffer: fileBuffer.toString('base64'),
        fileName,
        mimeType,
        fileSize: fileBuffer.length,
        etag,
        metadata,
      },
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
        error: error.userMessage || 'ファイルのダウンロードに失敗しました',
      };
    }

    logger.error('Failed to download file', error);
    return {
      success: false,
      error: 'ファイルのダウンロードに失敗しました',
    };
  }
}

/**
 * 複数ファイルを一括ダウンロード
 */
export async function batchDownload(params: z.infer<typeof batchDownloadSchema>) {
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

    // バリデーション
    const validatedData = batchDownloadSchema.parse(params);

    // ファイルの存在確認と権限チェック
    const files = await prisma.file.findMany({
      where: {
        id: {
          in: validatedData.fileIds,
        },
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (files.length === 0) {
      throw new AppError(
        'No files found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // アクセス権限のチェック
    const unauthorizedFiles = files.filter(file => {
      const isOwner = file.user.id === session.user.id;
      const isAdmin = session.user.role === 'ADMIN';
      const isPublic = file.isPublic;
      return !isOwner && !isAdmin && !isPublic;
    });

    if (unauthorizedFiles.length > 0) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        `${unauthorizedFiles.length}個のファイルへのアクセス権限がありません`
      );
    }

    // アーカイブを作成
    const archive = archiver(validatedData.format === 'zip' ? 'zip' : 'tar', {
      zlib: { level: 9 },
    });

    const chunks: Buffer[] = [];
    archive.on('data', (chunk) => chunks.push(chunk));

    // 各ファイルをアーカイブに追加
    for (const file of files) {
      const filePath = join(process.cwd(), 'public', file.filePath);
      
      try {
        const fileBuffer = await readFile(filePath);
        archive.append(fileBuffer, { name: file.fileName });

        // メタデータを含める場合
        if (validatedData.includeMetadata) {
          const metadata = {
            id: file.id,
            fileName: file.fileName,
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            createdAt: file.createdAt,
          };
          archive.append(JSON.stringify(metadata, null, 2), {
            name: `${file.fileName}.metadata.json`,
          });
        }
      } catch (error) {
        logger.warn('Failed to add file to archive', { fileId: file.id, error });
      }
    }

    // アーカイブを完成させる
    await archive.finalize();
    const archiveBuffer = Buffer.concat(chunks);

    // ダウンロード履歴を記録
    await prisma.downloadHistory.create({
      data: {
        userId: session.user.id,
        format: 'batch',
        fileSize: archiveBuffer.length,
        metadata: {
          fileIds: validatedData.fileIds,
          fileCount: files.length,
          archiveFormat: validatedData.format,
        },
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DOWNLOAD',
        entityType: 'batch',
        entityId: 'batch',
        metadata: {
          fileCount: files.length,
          archiveFormat: validatedData.format,
          totalSize: archiveBuffer.length,
        },
      },
    });

    logger.info('Batch download completed', {
      userId: session.user.id,
      fileCount: files.length,
      archiveSize: archiveBuffer.length,
    });

    return {
      success: true,
      data: {
        fileBuffer: archiveBuffer.toString('base64'),
        fileName: `files_${new Date().toISOString().split('T')[0]}.${validatedData.format}`,
        mimeType: validatedData.format === 'zip' ? 'application/zip' : 'application/x-tar',
        fileSize: archiveBuffer.length,
        fileCount: files.length,
      },
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
        error: error.userMessage || 'バッチダウンロードに失敗しました',
      };
    }

    logger.error('Failed to batch download', error);
    return {
      success: false,
      error: 'バッチダウンロードに失敗しました',
    };
  }
}

/**
 * レジューマブルダウンロード（部分的なダウンロード）
 */
export async function resumableDownload(params: z.infer<typeof resumableDownloadSchema>) {
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

    // バリデーション
    const validatedData = resumableDownloadSchema.parse(params);

    // ファイルの存在確認と権限チェック
    const file = await prisma.file.findUnique({
      where: { id: validatedData.fileId },
      include: {
        user: {
          select: { id: true, role: true },
        },
      },
    });

    if (!file) {
      throw new AppError(
        'File not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // アクセス権限のチェック
    const isOwner = file.user.id === session.user.id;
    const isAdmin = file.user.role === 'ADMIN';
    const isPublic = file.isPublic;

    if (!isOwner && !isAdmin && !isPublic) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'このファイルへのアクセス権限がありません'
      );
    }

    // ファイルパスを構築
    const filePath = join(process.cwd(), 'public', file.filePath);

    // ファイル情報を取得
    const fileStats = await stat(filePath);
    const fileSize = fileStats.size;

    // ETagを生成
    const fileBuffer = await readFile(filePath);
    const etag = createHash('md5').update(fileBuffer).digest('hex');

    // ETagチェック（変更がない場合は304を返す）
    if (validatedData.etag === etag) {
      return {
        success: true,
        data: {
          status: 304,
          message: 'Not Modified',
        },
      };
    }

    // Rangeヘッダーを解析
    let start = 0;
    let end = fileSize - 1;
    
    if (validatedData.range) {
      const match = validatedData.range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        start = parseInt(match[1], 10);
        if (match[2]) {
          end = parseInt(match[2], 10);
        }
      }
    }

    // 範囲の検証
    if (start >= fileSize || end >= fileSize || start > end) {
      throw new AppError(
        'Invalid range',
        ErrorCodes.VALIDATION_ERROR,
        416,
        true,
        '無効な範囲が指定されました'
      );
    }

    // 部分的なバッファを作成
    const partialBuffer = fileBuffer.slice(start, end + 1);

    // ダウンロード履歴を記録
    await prisma.downloadHistory.create({
      data: {
        fileId: validatedData.fileId,
        userId: session.user.id,
        format: 'partial',
        fileSize: partialBuffer.length,
        metadata: {
          range: `bytes=${start}-${end}`,
          totalSize: fileSize,
        },
      },
    });

    logger.info('Resumable download', {
      userId: session.user.id,
      fileId: validatedData.fileId,
      range: `bytes=${start}-${end}`,
    });

    return {
      success: true,
      data: {
        status: 206,
        fileBuffer: partialBuffer.toString('base64'),
        fileName: file.fileName,
        mimeType: file.mimeType,
        contentRange: `bytes ${start}-${end}/${fileSize}`,
        contentLength: partialBuffer.length,
        acceptRanges: 'bytes',
        etag,
      },
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
        error: error.userMessage || 'レジューマブルダウンロードに失敗しました',
      };
    }

    logger.error('Failed to resumable download', error);
    return {
      success: false,
      error: 'レジューマブルダウンロードに失敗しました',
    };
  }
}

/**
 * ダウンロード統計を取得
 */
export async function getDownloadStats(params: z.infer<typeof downloadStatsSchema>) {
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

    // バリデーション
    const validatedData = downloadStatsSchema.parse(params);

    // ファイルの存在確認と権限チェック
    const file = await prisma.file.findUnique({
      where: { id: validatedData.fileId },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!file) {
      throw new AppError(
        'File not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // 権限確認（所有者のみ統計を見れる）
    if (file.user.id !== session.user.id && session.user.role !== 'ADMIN') {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'この統計へのアクセス権限がありません'
      );
    }

    // 期間を計算
    const now = new Date();
    let startDate: Date;

    switch (validatedData.period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    // ダウンロード履歴を集計
    const [totalDownloads, uniqueUsers, downloads] = await Promise.all([
      // 総ダウンロード数
      prisma.downloadHistory.count({
        where: {
          fileId: validatedData.fileId,
          createdAt: {
            gte: startDate,
          },
        },
      }),

      // ユニークユーザー数
      prisma.downloadHistory.groupBy({
        by: ['userId'],
        where: {
          fileId: validatedData.fileId,
          createdAt: {
            gte: startDate,
          },
        },
        _count: true,
      }),

      // ダウンロード履歴（最新10件）
      prisma.downloadHistory.findMany({
        where: {
          fileId: validatedData.fileId,
          createdAt: {
            gte: startDate,
          },
        },
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
        take: 10,
      }),
    ]);

    // 日別ダウンロード数
    const dailyDownloads = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM download_history
      WHERE file_id = ${validatedData.fileId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    return {
      success: true,
      data: {
        fileId: validatedData.fileId,
        fileName: file.fileName,
        period: validatedData.period,
        stats: {
          totalDownloads,
          uniqueUsers: uniqueUsers.length,
          averageSize: file.fileSize,
          lastDownloadAt: file.lastDownloadAt,
        },
        recentDownloads: downloads,
        dailyDownloads,
      },
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
        error: error.userMessage || 'ダウンロード統計の取得に失敗しました',
      };
    }

    logger.error('Failed to get download stats', error);
    return {
      success: false,
      error: 'ダウンロード統計の取得に失敗しました',
    };
  }
}

/**
 * PPTXをPDFに変換（ヘルパー関数）
 */
async function convertToPdf(inputPath: string): Promise<string> {
  // 実装は省略（LibreOfficeやPuppeteerを使用）
  return inputPath.replace(/\.pptx$/, '.pdf');
}

/**
 * PPTXを画像に変換（ヘルパー関数）
 */
async function convertToImages(inputPath: string): Promise<string> {
  // 実装は省略（pdf2imageなどを使用）
  return inputPath.replace(/\.pptx$/, '_images.zip');
}

/**
 * テキストを抽出（ヘルパー関数）
 */
async function extractText(inputPath: string): Promise<string> {
  // 実装は省略（python-pptxなどを使用）
  return inputPath.replace(/\.pptx$/, '.txt');
}
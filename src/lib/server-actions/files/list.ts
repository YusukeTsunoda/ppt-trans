'use server';

import { ServerActionState, createSuccessState, createErrorState } from '../types';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// ファイルと翻訳を含む型
export interface FileWithTranslations {
  id: string;
  fileName: string;
  fileSize: number;
  originalFileUrl: string;
  translatedFileUrl: string | null;
  createdAt: Date;
  status: string;
  totalSlides: number | null;
  translations: Array<{
    id: string;
    targetLanguage: string | null;
    completedAt: Date | null;
    status: string | null;
  }>;
}

export interface ListFilesResult {
  files: FileWithTranslations[];
  total: number;
  page: number;
  limit: number;
}

/**
 * ファイルリスト取得 Server Action
 */
export async function listFilesAction(
  prevState: ServerActionState<ListFilesResult>,
  formData: FormData
): Promise<ServerActionState<ListFilesResult>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorState('ログインが必要です');
    }

    const page = parseInt(formData.get('page') as string) || 1;
    const limit = parseInt(formData.get('limit') as string) || 20;
    const sortBy = formData.get('sortBy') as string || 'uploadedAt';
    const sortOrder = formData.get('sortOrder') as string || 'desc';

    // ページネーション計算
    const skip = (page - 1) * limit;

    // ファイルと翻訳データを取得
    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where: { userId: session.user.id },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          translations: {
            select: {
              id: true,
              targetLanguage: true,
              completedAt: true,
              status: true,
            },
          },
        },
      }),
      prisma.file.count({
        where: { userId: session.user.id },
      }),
    ]);

    logger.info('Files listed', {
      userId: session.user.id,
      count: files.length,
      page,
      total,
    });

    return createSuccessState(
      {
        files: files.map((file: any) => ({
          id: file.id,
          fileName: file.fileName,
          fileSize: file.fileSize,
          originalFileUrl: file.originalFileUrl,
          translatedFileUrl: file.translatedFileUrl,
          createdAt: file.createdAt,
          status: file.status,
          totalSlides: file.totalSlides,
          translations: file.translations,
        })),
        total,
        page,
        limit,
      },
      'ファイルリストを取得しました'
    );
  } catch (error) {
    logger.error('List files error', error);
    return createErrorState('ファイルリストの取得中にエラーが発生しました');
  }
}
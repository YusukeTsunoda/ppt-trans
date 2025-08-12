'use server';

import { ServerActionState, createSuccessState, createErrorState } from '../types';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface DeleteFileResult {
  deletedFileId: string;
}

/**
 * ファイル削除 Server Action
 */
export async function deleteFileAction(
  prevState: ServerActionState<DeleteFileResult>,
  formData: FormData
): Promise<ServerActionState<DeleteFileResult>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return createErrorState('ログインが必要です');
    }

    const fileId = formData.get('fileId') as string;

    if (!fileId) {
      return createErrorState('ファイルIDが必要です');
    }

    // ファイルの所有権を確認
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        userId: session.user.id,
      },
    });

    if (!file) {
      return createErrorState('ファイルが見つからないか、アクセス権限がありません');
    }

    // ファイルと関連データを削除
    await prisma.file.delete({
      where: { id: fileId },
    });

    logger.info('File deleted', {
      userId: session.user.id,
      fileId,
    });

    return createSuccessState(
      { deletedFileId: fileId },
      'ファイルを削除しました'
    );
  } catch (error) {
    logger.error('Delete file error', error);
    return createErrorState('ファイル削除中にエラーが発生しました');
  }
}
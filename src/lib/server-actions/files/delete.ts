'use server';

import { ServerActionState, createSuccessState, createErrorState } from '../types';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth-helpers';

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
    const user = await getCurrentUser();
    if (!user) {
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
        userId: user.id,
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
      userId: user.id,
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
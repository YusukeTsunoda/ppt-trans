'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabaseClient';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface DeleteState {
  success: boolean;
  error?: string;
  deletedFileId?: string;
  message?: string;
}

/**
 * ファイルを削除するServer Action
 * 自動的にCSRF保護が適用される
 */
export async function deleteFileAction(
  fileId: string
): Promise<DeleteState> {
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
    
    // ファイル情報取得
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        translations: true
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
      logger.warn('Unauthorized file deletion attempt', { 
        userId: session.user.id,
        fileId,
        ownerId: file.userId
      });
      
      return {
        success: false,
        error: 'このファイルを削除する権限がありません'
      };
    }
    
    // Supabaseからファイル削除
    if (file.originalFileUrl?.includes('supabase')) {
      try {
        const fileName = file.originalFileUrl.split('/').pop();
        const filePath = `uploads/${file.userId}/${fileName}`;
        
        const { error: deleteError } = await supabase.storage
          .from('pptx-files')
          .remove([filePath]);
        
        if (deleteError) {
          logger.warn('Supabase file deletion error', deleteError as unknown as Record<string, unknown>);
        }
        
        // 翻訳済みファイルも削除
        if (file.translatedFileUrl?.includes('supabase')) {
          const translatedFileName = file.translatedFileUrl.split('/').pop();
          const translatedPath = `translated/${file.userId}/${translatedFileName}`;
          
          await supabase.storage
            .from('pptx-files')
            .remove([translatedPath]);
        }
      } catch (error) {
        logger.warn('Supabase deletion failed', error as Record<string, unknown>);
        // エラーは無視して続行（ローカルファイルかもしれない）
      }
    }
    
    // ローカルファイル削除（フォールバック）
    if (file.originalFileUrl?.startsWith('/tmp/')) {
      try {
        const localPath = join(process.cwd(), file.originalFileUrl);
        if (existsSync(localPath)) {
          await unlink(localPath);
        }
      } catch (error) {
        logger.warn('Local file deletion failed', error as Record<string, unknown>);
      }
    }
    
    // データベースから削除（カスケード削除で関連データも削除）
    await prisma.$transaction(async (tx) => {
      // 翻訳データ削除
      if (file.translations.length > 0) {
        await tx.translation.deleteMany({
          where: { fileId }
        });
      }
      
      // アクティビティログに記録
      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          action: 'FILE_DELETE',
          targetType: 'file',
          targetId: fileId,
          metadata: {
            fileName: file.fileName,
            fileSize: file.fileSize,
            deletedBy: session.user.id,
            isOwner: file.userId === session.user.id
          }
        }
      });
      
      // ファイル削除
      await tx.file.delete({
        where: { id: fileId }
      });
      
      // 使用量更新（月内削除の場合はカウントを減らす）
      const currentMonth = new Date().getMonth();
      const fileMonth = file.createdAt.getMonth();
      
      if (currentMonth === fileMonth) {
        const usageLimit = await tx.usageLimit.findUnique({
          where: { userId: file.userId }
        });
        
        if (usageLimit && usageLimit.currentMonthFiles > 0) {
          await tx.usageLimit.update({
            where: { userId: file.userId },
            data: {
              currentMonthFiles: { decrement: 1 }
            }
          });
        }
      }
    });
    
    logger.info('File deleted successfully', { 
      userId: session.user.id,
      fileId,
      fileName: file.fileName,
      duration: Date.now() - startTime
    });
    
    // キャッシュを再検証
    revalidatePath('/files');
    revalidatePath('/');
    
    return {
      success: true,
      deletedFileId: fileId,
      message: 'ファイルを削除しました'
    };
    
  } catch (error) {
    logger.error('File deletion error', error);
    
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.FILE_DELETE_FAILED,
      500,
      false,
      'ファイル削除中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      userId: (await getServerSession(authOptions))?.user?.id,
      fileId,
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || '削除に失敗しました'
    };
  }
}

/**
 * 複数ファイルを一括削除するServer Action
 */
export async function bulkDeleteFilesAction(
  fileIds: string[]
): Promise<{
  success: boolean;
  error?: string;
  deletedCount: number;
  failedCount: number;
  results: DeleteState[];
}> {
  const startTime = Date.now();
  const results: DeleteState[] = [];
  let deletedCount = 0;
  let failedCount = 0;
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です',
        deletedCount: 0,
        failedCount: fileIds.length,
        results: []
      };
    }
    
    // 各ファイルを順次削除
    for (const fileId of fileIds) {
      const result = await deleteFileAction(fileId);
      results.push(result);
      
      if (result.success) {
        deletedCount++;
      } else {
        failedCount++;
      }
    }
    
    logger.info('Bulk file deletion completed', { 
      userId: session.user.id,
      totalFiles: fileIds.length,
      deletedCount,
      failedCount,
      duration: Date.now() - startTime
    });
    
    return {
      success: failedCount === 0,
      error: failedCount > 0 ? `${failedCount}個のファイルの削除に失敗しました` : undefined,
      deletedCount,
      failedCount,
      results
    };
    
  } catch (error) {
    logger.error('Bulk deletion error', error);
    
    return {
      success: false,
      error: '一括削除中にエラーが発生しました',
      deletedCount,
      failedCount: fileIds.length - deletedCount,
      results
    };
  }
}
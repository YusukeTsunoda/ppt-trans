'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
// import { AppError } from '@/lib/errors/AppError';
// import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
// import path from 'path';
// import { TimeoutConfig } from '@/lib/config/timeout';

interface ChunkUploadState {
  success: boolean;
  error?: string;
  sessionId?: string;
  message?: string;
  isComplete?: boolean;
  mergedFileUrl?: string;
}

// チャンクセッション管理（実際の実装ではRedisなどを使用）
const chunkSessions = new Map<string, {
  userId: string;
  fileName: string;
  totalChunks: number;
  receivedChunks: Set<number>;
  chunkPaths: Map<number, string>;
  startedAt: Date;
  lastActivityAt: Date;
}>();

/**
 * チャンクアップロードを処理
 */
export async function uploadChunkAction(
  formData: FormData
): Promise<ChunkUploadState> {
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // FormDataから情報を取得
    const chunk = formData.get('chunk') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileName = formData.get('fileName') as string;
    const sessionId = formData.get('sessionId') as string || uuidv4();
    const isLast = formData.get('isLast') === 'true';
    
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return {
        success: false,
        error: '不正なチャンク情報です'
      };
    }
    
    // セッション取得または作成
    let chunkSession = chunkSessions.get(sessionId);
    if (!chunkSession) {
      chunkSession = {
        userId: session.user.id,
        fileName,
        totalChunks,
        receivedChunks: new Set(),
        chunkPaths: new Map(),
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      chunkSessions.set(sessionId, chunkSession);
      
      logger.info('Chunk upload session created', {
        sessionId,
        fileName,
        totalChunks,
        userId: session.user.id,
      });
    }
    
    // ユーザー確認
    if (chunkSession.userId !== session.user.id) {
      return {
        success: false,
        error: '不正なセッションです'
      };
    }
    
    // タイムアウトチェック（30分）
    const sessionTimeout = 30 * 60 * 1000;
    if (Date.now() - chunkSession.startedAt.getTime() > sessionTimeout) {
      chunkSessions.delete(sessionId);
      return {
        success: false,
        error: 'セッションがタイムアウトしました'
      };
    }
    
    // チャンクを一時保存
    const tempDir = join(process.cwd(), 'tmp', 'chunks', sessionId);
    await mkdir(tempDir, { recursive: true });
    
    const chunkPath = join(tempDir, `chunk_${chunkIndex}`);
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    await writeFile(chunkPath, chunkBuffer);
    
    // セッション更新
    chunkSession.receivedChunks.add(chunkIndex);
    chunkSession.chunkPaths.set(chunkIndex, chunkPath);
    chunkSession.lastActivityAt = new Date();
    
    logger.debug('Chunk received', {
      sessionId,
      chunkIndex,
      totalChunks,
      receivedCount: chunkSession.receivedChunks.size,
    });
    
    // すべてのチャンクを受信したか確認
    if (chunkSession.receivedChunks.size === totalChunks || isLast) {
      // チャンクをマージ
      const mergedFileUrl = await mergeChunks(sessionId, chunkSession);
      
      // セッションをクリーンアップ
      await cleanupChunkSession(sessionId);
      chunkSessions.delete(sessionId);
      
      logger.info('All chunks received and merged', {
        sessionId,
        fileName,
        totalChunks,
      });
      
      return {
        success: true,
        sessionId,
        message: 'アップロード完了',
        isComplete: true,
        mergedFileUrl,
      };
    }
    
    return {
      success: true,
      sessionId,
      message: `チャンク ${chunkIndex + 1}/${totalChunks} を受信しました`,
      isComplete: false,
    };
    
  } catch (error) {
    logger.error('Chunk upload error', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'チャンクアップロードに失敗しました'
    };
  }
}

/**
 * チャンクをマージ
 */
async function mergeChunks(
  sessionId: string,
  chunkSession: {
    fileName: string;
    totalChunks: number;
    chunkPaths: Map<number, string>;
  }
): Promise<string> {
  const outputDir = join(process.cwd(), 'tmp', 'uploads', sessionId);
  await mkdir(outputDir, { recursive: true });
  
  const outputPath = join(outputDir, chunkSession.fileName);
  const writeStream = await import('fs').then(fs => fs.createWriteStream(outputPath));
  
  // チャンクを順番に書き込み
  for (let i = 0; i < chunkSession.totalChunks; i++) {
    const chunkPath = chunkSession.chunkPaths.get(i);
    if (!chunkPath) {
      throw new Error(`Chunk ${i} is missing`);
    }
    
    const chunkData = await readFile(chunkPath);
    writeStream.write(chunkData);
  }
  
  return new Promise((resolve, reject) => {
    writeStream.end(() => {
      logger.info('Chunks merged successfully', {
        sessionId,
        outputPath,
        totalChunks: chunkSession.totalChunks,
      });
      resolve(outputPath);
    });
    
    writeStream.on('error', reject);
  });
}

/**
 * チャンクセッションのクリーンアップ
 */
async function cleanupChunkSession(sessionId: string): Promise<void> {
  const chunkSession = chunkSessions.get(sessionId);
  if (!chunkSession) return;
  
  // チャンクファイルを削除
  for (const chunkPath of chunkSession.chunkPaths.values()) {
    try {
      await unlink(chunkPath);
    } catch (error) {
      logger.warn('Failed to delete chunk file', { chunkPath, error });
    }
  }
  
  // チャンクディレクトリを削除
  const tempDir = join(process.cwd(), 'tmp', 'chunks', sessionId);
  try {
    await import('fs').then(fs => fs.promises.rmdir(tempDir));
  } catch (error) {
    logger.warn('Failed to delete chunk directory', { tempDir, error });
  }
}

/**
 * アップロード進捗を取得
 */
export async function getChunkUploadProgressAction(
  sessionId: string
): Promise<{
  success: boolean;
  progress?: number;
  receivedChunks?: number;
  totalChunks?: number;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const chunkSession = chunkSessions.get(sessionId);
    if (!chunkSession) {
      return {
        success: false,
        error: 'セッションが見つかりません'
      };
    }
    
    if (chunkSession.userId !== session.user.id) {
      return {
        success: false,
        error: '不正なセッションです'
      };
    }
    
    const progress = (chunkSession.receivedChunks.size / chunkSession.totalChunks) * 100;
    
    return {
      success: true,
      progress,
      receivedChunks: chunkSession.receivedChunks.size,
      totalChunks: chunkSession.totalChunks,
    };
    
  } catch (error) {
    logger.error('Get chunk progress error', error);
    return {
      success: false,
      error: 'プログレス取得に失敗しました'
    };
  }
}

/**
 * チャンクアップロードをキャンセル
 */
export async function cancelChunkUploadAction(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const chunkSession = chunkSessions.get(sessionId);
    if (!chunkSession) {
      return {
        success: false,
        error: 'セッションが見つかりません'
      };
    }
    
    if (chunkSession.userId !== session.user.id) {
      return {
        success: false,
        error: '不正なセッションです'
      };
    }
    
    // クリーンアップ
    await cleanupChunkSession(sessionId);
    chunkSessions.delete(sessionId);
    
    logger.info('Chunk upload cancelled', {
      sessionId,
      userId: session.user.id,
    });
    
    return {
      success: true,
    };
    
  } catch (error) {
    logger.error('Cancel chunk upload error', error);
    return {
      success: false,
      error: 'キャンセルに失敗しました'
    };
  }
}

/**
 * 定期的にタイムアウトしたセッションをクリーンアップ
 */
export async function cleanupExpiredChunkSessions(): Promise<void> {
  const now = Date.now();
  const sessionTimeout = 30 * 60 * 1000; // 30分
  
  for (const [sessionId, session] of chunkSessions.entries()) {
    if (now - session.lastActivityAt.getTime() > sessionTimeout) {
      logger.info('Cleaning up expired chunk session', {
        sessionId,
        fileName: session.fileName,
        age: now - session.startedAt.getTime(),
      });
      
      await cleanupChunkSession(sessionId);
      chunkSessions.delete(sessionId);
    }
  }
}
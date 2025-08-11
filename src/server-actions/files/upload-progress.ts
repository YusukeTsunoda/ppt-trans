'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getRedisClient } from '@/lib/queue/config';
import logger from '@/lib/logger';

const PROGRESS_TTL = 3600; // 1時間

export interface UploadProgress {
  uploadId: string;
  fileName: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  message?: string;
  startedAt: string;
  updatedAt: string;
  estimatedTimeRemaining?: number;
  currentStep?: string;
  steps?: {
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
  }[];
}

/**
 * アップロード進捗を設定
 */
export async function setUploadProgressAction(
  uploadId: string,
  progress: Partial<UploadProgress>
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const redis = getRedisClient();
    const key = `upload:progress:${session.user.id}:${uploadId}`;
    
    // 既存の進捗データを取得
    const existingData = await redis.get(key);
    const currentProgress = existingData ? JSON.parse(existingData) : {};
    
    // 進捗データを更新
    const updatedProgress: UploadProgress = {
      ...currentProgress,
      ...progress,
      uploadId,
      updatedAt: new Date().toISOString()
    };
    
    // 進捗率を計算
    if (updatedProgress.uploadedBytes && updatedProgress.fileSize) {
      updatedProgress.progress = Math.round(
        (updatedProgress.uploadedBytes / updatedProgress.fileSize) * 100
      );
    }
    
    // 推定残り時間を計算
    if (updatedProgress.startedAt && updatedProgress.progress > 0 && updatedProgress.progress < 100) {
      const elapsedTime = Date.now() - new Date(updatedProgress.startedAt).getTime();
      const estimatedTotal = elapsedTime / (updatedProgress.progress / 100);
      updatedProgress.estimatedTimeRemaining = Math.round(estimatedTotal - elapsedTime);
    }
    
    // Redisに保存
    await redis.setex(key, PROGRESS_TTL, JSON.stringify(updatedProgress));
    
    logger.info('Upload progress updated', {
      userId: session.user.id,
      uploadId,
      progress: updatedProgress.progress
    });
    
    return {
      success: true
    };
    
  } catch (error) {
    logger.error('Failed to set upload progress', error);
    return {
      success: false,
      error: '進捗の更新に失敗しました'
    };
  }
}

/**
 * アップロード進捗を取得
 */
export async function getUploadProgressAction(
  uploadId: string
): Promise<{
  success: boolean;
  error?: string;
  progress?: UploadProgress;
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const redis = getRedisClient();
    const key = `upload:progress:${session.user.id}:${uploadId}`;
    
    const data = await redis.get(key);
    
    if (!data) {
      return {
        success: false,
        error: '進捗データが見つかりません'
      };
    }
    
    const progress = JSON.parse(data) as UploadProgress;
    
    return {
      success: true,
      progress
    };
    
  } catch (error) {
    logger.error('Failed to get upload progress', error);
    return {
      success: false,
      error: '進捗の取得に失敗しました'
    };
  }
}

/**
 * 複数のアップロード進捗を取得
 */
export async function getActiveUploadsAction(): Promise<{
  success: boolean;
  error?: string;
  uploads?: UploadProgress[];
}> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const redis = getRedisClient();
    const pattern = `upload:progress:${session.user.id}:*`;
    
    // パターンにマッチするキーを取得
    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      return {
        success: true,
        uploads: []
      };
    }
    
    // 各キーのデータを取得
    const uploads: UploadProgress[] = [];
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const progress = JSON.parse(data) as UploadProgress;
        
        // アクティブなアップロードのみ含める
        if (progress.status !== 'completed' && progress.status !== 'failed') {
          uploads.push(progress);
        }
      }
    }
    
    // 開始時刻でソート（新しい順）
    uploads.sort((a, b) => 
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    
    return {
      success: true,
      uploads
    };
    
  } catch (error) {
    logger.error('Failed to get active uploads', error);
    return {
      success: false,
      error: 'アクティブなアップロードの取得に失敗しました'
    };
  }
}

/**
 * アップロード進捗を削除
 */
export async function clearUploadProgressAction(
  uploadId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const redis = getRedisClient();
    const key = `upload:progress:${session.user.id}:${uploadId}`;
    
    await redis.del(key);
    
    logger.info('Upload progress cleared', {
      userId: session.user.id,
      uploadId
    });
    
    return {
      success: true
    };
    
  } catch (error) {
    logger.error('Failed to clear upload progress', error);
    return {
      success: false,
      error: '進捗のクリアに失敗しました'
    };
  }
}

/**
 * ステップベースの進捗更新
 */
export async function updateUploadStepAction(
  uploadId: string,
  stepName: string,
  stepStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    const redis = getRedisClient();
    const key = `upload:progress:${session.user.id}:${uploadId}`;
    
    // 既存の進捗データを取得
    const existingData = await redis.get(key);
    const currentProgress = existingData ? JSON.parse(existingData) as UploadProgress : null;
    
    if (!currentProgress) {
      return {
        success: false,
        error: '進捗データが見つかりません'
      };
    }
    
    // ステップ情報を更新
    if (!currentProgress.steps) {
      currentProgress.steps = [];
    }
    
    const stepIndex = currentProgress.steps.findIndex(s => s.name === stepName);
    const now = new Date().toISOString();
    
    if (stepIndex >= 0) {
      // 既存のステップを更新
      currentProgress.steps[stepIndex].status = stepStatus;
      
      if (stepStatus === 'in_progress' && !currentProgress.steps[stepIndex].startedAt) {
        currentProgress.steps[stepIndex].startedAt = now;
      }
      
      if (stepStatus === 'completed' || stepStatus === 'failed') {
        currentProgress.steps[stepIndex].completedAt = now;
      }
    } else {
      // 新しいステップを追加
      currentProgress.steps.push({
        name: stepName,
        status: stepStatus,
        startedAt: stepStatus === 'in_progress' ? now : undefined,
        completedAt: stepStatus === 'completed' || stepStatus === 'failed' ? now : undefined
      });
    }
    
    // 現在のステップを更新
    if (stepStatus === 'in_progress') {
      currentProgress.currentStep = stepName;
    }
    
    // 全体の進捗を計算（完了したステップの割合）
    const completedSteps = currentProgress.steps.filter(s => s.status === 'completed').length;
    const totalSteps = currentProgress.steps.length;
    
    if (totalSteps > 0) {
      currentProgress.progress = Math.round((completedSteps / totalSteps) * 100);
    }
    
    currentProgress.updatedAt = now;
    
    // Redisに保存
    await redis.setex(key, PROGRESS_TTL, JSON.stringify(currentProgress));
    
    logger.info('Upload step updated', {
      userId: session.user.id,
      uploadId,
      stepName,
      stepStatus
    });
    
    return {
      success: true
    };
    
  } catch (error) {
    logger.error('Failed to update upload step', error);
    return {
      success: false,
      error: 'ステップの更新に失敗しました'
    };
  }
}
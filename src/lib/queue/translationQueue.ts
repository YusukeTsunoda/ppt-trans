import Bull from 'bull';
import { getRedisClient, redisConfig, cacheKeys, cacheTTL, isRedisAvailable } from './config';
import logger from '@/lib/logger';
import type { JsonObject } from '@/types/common';

// 翻訳ジョブの型定義
export interface TranslationJobData {
  id: string;
  texts: Array<{
    id: string;
    original: string;
  }>;
  targetLanguage: string;
  model: string;
  userId?: string;
  metadata?: JsonObject;
}

export interface TranslationJobResult {
  translations: Array<{
    id: string;
    translatedText: string;
  }>;
  cached: boolean;
  duration: number;
}

// 翻訳キューの作成（Redisが利用可能な場合のみ）
let translationQueue: Bull.Queue<TranslationJobData> | null = null;

if (isRedisAvailable()) {
  try {
    translationQueue = new Bull<TranslationJobData>('translation', {
      redis: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100, // 完了したジョブを100個まで保持
        removeOnFail: 50, // 失敗したジョブを50個まで保持
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
    logger.info('Translation queue initialized with Redis');
  } catch (error) {
    logger.warn('Failed to initialize translation queue with Redis', {
      error: error instanceof Error ? error.message : String(error)
    });
    translationQueue = null;
  }
} else {
  logger.info('Translation queue: Redis not available, using direct processing');
}

export { translationQueue };

// キューイベントハンドラー
if (translationQueue) {
  translationQueue.on('completed', (job, result) => {
    logger.info(`Translation job ${job.id} completed`, {
      jobId: job.id,
      cached: result.cached,
      duration: result.duration,
    });
  });

  translationQueue.on('failed', (job, err) => {
    logger.error(`Translation job ${job?.id} failed`, {
      jobId: job?.id,
      error: err.message,
      stack: err.stack,
    });
  });

  translationQueue.on('stalled', (job) => {
    logger.warn(`Translation job ${job.id} stalled`, {
      jobId: job.id,
    });
  });
}

// ジョブプロセッサー
if (translationQueue) {
  translationQueue.process(5, async (job) => {
    const startTime = Date.now();
    const { texts, targetLanguage, model } = job.data;
    const redis = getRedisClient();
  
  try {
    const translations: Array<{ id: string; translatedText: string }> = [];
    let cachedCount = 0;

    // バッチ処理のためのテキストグループ化
    const batchSize = 10;
    const batches: typeof texts[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }

    // 進捗更新
    let processedCount = 0;

    for (const batch of batches) {
      const batchTranslations = await Promise.all(
        batch.map(async (text) => {
          // Redisが利用可能な場合のみキャッシュチェック
          if (redis) {
            const cacheKey = cacheKeys.translation(text.original, targetLanguage);
            const cached = await redis.get(cacheKey);
            
            if (cached) {
              cachedCount++;
              return {
                id: text.id,
                translatedText: cached,
              };
            }
          }

          // 実際の翻訳処理（キャッシュがない場合）
          // ここでは実際のAPIコールの代わりにシミュレート
          const translatedText = await translateText(text.original, targetLanguage, model);
          
          // Redisが利用可能な場合のみキャッシュに保存
          if (redis) {
            const cacheKey = cacheKeys.translation(text.original, targetLanguage);
            await redis.setex(cacheKey, cacheTTL.translation, translatedText);
          }
          
          return {
            id: text.id,
            translatedText,
          };
        })
      );

      translations.push(...batchTranslations);
      processedCount += batch.length;
      
      // ジョブの進捗を更新
      await job.progress(Math.round((processedCount / texts.length) * 100));
    }

    const duration = Date.now() - startTime;
    
    logger.info(`Translation batch completed`, {
      totalTexts: texts.length,
      cachedTexts: cachedCount,
      duration,
    });

    return {
      translations,
      cached: cachedCount > 0,
      duration,
    };
  } catch (error) {
    logger.error('Translation job processing error', error);
    throw error;
  }
  });
}

// 実際の翻訳関数（Anthropic APIを呼び出す）
async function translateText(
  text: string,
  targetLanguage: string,
  model: string
): Promise<string> {
  // Anthropic APIを呼び出す実装
  // 既存の翻訳ロジックを使用
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [{ id: '1', originalText: text }],
      targetLanguage,
      model,
    }),
  });

  if (!response.ok) {
    throw new Error('Translation API failed');
  }

  const data = await response.json();
  return data.translations[0].translatedText;
}

// ジョブの追加
export async function addTranslationJob(
  data: TranslationJobData
): Promise<Bull.Job<TranslationJobData> | null> {
  if (!translationQueue) {
    logger.warn('Translation queue not available, processing directly');
    // キューが利用できない場合は直接処理
    // ここではダミーのジョブオブジェクトを返すか、nullを返す
    return null;
  }
  
  try {
    const priority = typeof data.metadata?.priority === 'number' ? data.metadata.priority : 0;
    const delay = typeof data.metadata?.delay === 'number' ? data.metadata.delay : 0;
    
    const job = await translationQueue.add('translate', data, {
      priority,
      delay,
    });

    logger.info('Translation job added to queue', {
      jobId: job.id,
      textsCount: data.texts.length,
    });

    return job;
  } catch (error) {
    logger.error('Failed to add translation job', error);
    throw error;
  }
}

// ジョブステータスの取得
export async function getJobStatus(jobId: string) {
  if (!translationQueue) {
    return null;
  }
  
  try {
    const job = await translationQueue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    
    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      createdAt: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
  } catch (error) {
    logger.error('Failed to get job status', error);
    throw error;
  }
}

// キューの統計情報取得
export async function getQueueStats() {
  if (!translationQueue) {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    };
  }
  
  try {
    const [
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount,
    ] = await Promise.all([
      translationQueue.getWaitingCount(),
      translationQueue.getActiveCount(),
      translationQueue.getCompletedCount(),
      translationQueue.getFailedCount(),
      translationQueue.getDelayedCount(),
    ]);

    return {
      waiting: waitingCount,
      active: activeCount,
      completed: completedCount,
      failed: failedCount,
      delayed: delayedCount,
      total: waitingCount + activeCount + delayedCount,
    };
  } catch (error) {
    logger.error('Failed to get queue stats', error);
    throw error;
  }
}

// キューのクリーンアップ
export async function cleanQueue() {
  if (!translationQueue) {
    logger.info('Translation queue not available, skipping cleanup');
    return;
  }
  
  try {
    await translationQueue.clean(24 * 60 * 60 * 1000); // 24時間以上前のジョブを削除
    await translationQueue.clean(24 * 60 * 60 * 1000, 'failed');
    
    logger.info('Translation queue cleaned');
  } catch (error) {
    logger.error('Failed to clean queue', error);
    throw error;
  }
}
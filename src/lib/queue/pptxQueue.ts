import Bull from 'bull';
import { redisConfig } from './config';
import logger from '@/lib/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import type { JsonValue, JsonObject } from '@/types/common';
import type { SlideData } from '@/types/index';

const execAsync = promisify(exec);

// PPTXジョブの型定義
export interface PPTXJobData {
  id: string;
  type: 'process' | 'generate';
  fileUrl: string;
  userId?: string;
  metadata?: JsonObject & {
    fileName?: string;
    fileSize?: number;
    slideCount?: number;
    editedSlides?: SlideData[];
    priority?: number;
    delay?: number;
  };
}

export interface PPTXJobResult {
  success: boolean;
  outputUrl?: string;
  slides?: SlideData[];
  error?: string;
  duration: number;
}

// PPTXキューの作成
export const pptxQueue = new Bull<PPTXJobData>('pptx-processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    timeout: 5 * 60 * 1000, // 5分のタイムアウト
  },
});

// キューイベントハンドラー
pptxQueue.on('completed', (job, result) => {
  logger.info(`PPTX job ${job.id} completed`, {
    jobId: job.id,
    type: job.data.type,
    success: result.success,
    duration: result.duration,
  });
});

pptxQueue.on('failed', (job, err) => {
  logger.error(`PPTX job ${job?.id} failed`, {
    jobId: job?.id,
    type: job?.data.type,
    error: err.message,
  });
});

pptxQueue.on('progress', (job, progress) => {
  logger.debug(`PPTX job ${job.id} progress: ${progress}%`, {
    jobId: job.id,
    progress,
  });
});

// ジョブプロセッサー
pptxQueue.process(2, async (job) => { // 同時に2つまで処理
  const startTime = Date.now();
  const { type, fileUrl, metadata } = job.data;
  
  try {
    let result: PPTXJobResult;
    
    if (type === 'process') {
      result = await processPPTX(job, fileUrl, metadata);
    } else if (type === 'generate') {
      result = await generatePPTX(job, fileUrl, metadata);
    } else {
      throw new Error(`Unknown job type: ${type}`);
    }
    
    result.duration = Date.now() - startTime;
    return result;
  } catch (error) {
    logger.error('PPTX job processing error', error);
    throw error;
  }
});

// PPTX処理（画像変換とテキスト抽出）
async function processPPTX(
  job: Bull.Job<PPTXJobData>,
  fileUrl: string,
  _metadata?: PPTXJobData['metadata']
): Promise<PPTXJobResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'process_pptx.py');
  
  try {
    // 進捗更新: 開始
    await job.progress(10);
    
    // Pythonスクリプトを実行
    const { stdout: _stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${fileUrl}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB
        timeout: 4 * 60 * 1000, // 4分
      }
    );
    
    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('PPTX processing stderr:', { stderr });
    }
    
    // 進捗更新: 処理完了
    await job.progress(90);
    
    const result = JSON.parse(_stdout);
    
    // 進捗更新: 完了
    await job.progress(100);
    
    return {
      success: true,
      slides: result.slides,
      duration: 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0,
    };
  }
}

// PPTX生成（翻訳済みファイル生成）
async function generatePPTX(
  job: Bull.Job<PPTXJobData>,
  fileUrl: string,
  metadata?: PPTXJobData['metadata']
): Promise<PPTXJobResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'generate_pptx_v2.py');
  const outputDir = path.join(process.cwd(), 'public', 'generated');
  
  try {
    // 出力ディレクトリの確認
    await fs.mkdir(outputDir, { recursive: true });
    
    // 進捗更新: 開始
    await job.progress(10);
    
    // 入力データの準備
    const inputData = {
      original_file: fileUrl,
      edited_slides: metadata?.editedSlides || [],
    };
    
    const inputFile = path.join(outputDir, `input_${job.id}.json`);
    await fs.writeFile(inputFile, JSON.stringify(inputData));
    
    // 進捗更新: データ準備完了
    await job.progress(30);
    
    // Pythonスクリプトを実行
    const outputFile = path.join(outputDir, `translated_${job.id}.pptx`);
    const { stdout: _stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${inputFile}" "${outputFile}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB
        timeout: 4 * 60 * 1000, // 4分
      }
    );
    
    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('PPTX generation stderr:', { stderr });
    }
    
    // 進捗更新: 生成完了
    await job.progress(80);
    
    // 一時ファイルの削除
    await fs.unlink(inputFile).catch(() => {});
    
    // 進捗更新: クリーンアップ完了
    await job.progress(90);
    
    // 出力ファイルのURLを生成
    const outputUrl = `/generated/translated_${job.id}.pptx`;
    
    // 進捗更新: 完了
    await job.progress(100);
    
    return {
      success: true,
      outputUrl,
      duration: 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: 0,
    };
  }
}

// ジョブの追加
export async function addPPTXJob(
  data: PPTXJobData
): Promise<Bull.Job<PPTXJobData>> {
  try {
    const job = await pptxQueue.add('process-pptx', data, {
      priority: data.metadata?.priority || 0,
      delay: data.metadata?.delay || 0,
    });

    logger.info('PPTX job added to queue', {
      jobId: job.id,
      type: data.type,
    });

    return job;
  } catch (error) {
    logger.error('Failed to add PPTX job', error);
    throw error;
  }
}

// ジョブステータスの取得
export async function getPPTXJobStatus(jobId: string) {
  try {
    const job = await pptxQueue.getJob(jobId);
    
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
    logger.error('Failed to get PPTX job status', error);
    throw error;
  }
}

// キューの統計情報取得
export async function getPPTXQueueStats() {
  try {
    const [
      waitingCount,
      activeCount,
      completedCount,
      failedCount,
      delayedCount,
    ] = await Promise.all([
      pptxQueue.getWaitingCount(),
      pptxQueue.getActiveCount(),
      pptxQueue.getCompletedCount(),
      pptxQueue.getFailedCount(),
      pptxQueue.getDelayedCount(),
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
    logger.error('Failed to get PPTX queue stats', error);
    throw error;
  }
}

// キューのクリーンアップ
export async function cleanPPTXQueue() {
  try {
    await pptxQueue.clean(12 * 60 * 60 * 1000); // 12時間以上前のジョブを削除
    await pptxQueue.clean(12 * 60 * 60 * 1000, 'failed');
    
    logger.info('PPTX queue cleaned');
  } catch (error) {
    logger.error('Failed to clean PPTX queue', error);
    throw error;
  }
}
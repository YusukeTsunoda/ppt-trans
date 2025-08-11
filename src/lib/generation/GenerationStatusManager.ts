import logger from '@/lib/logger';

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface GenerationJob {
  id: string;
  status: GenerationStatus;
  progress: number; // 0-100
  message?: string;
  originalFileUrl?: string;
  outputFileUrl?: string;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * ファイル生成ステータス管理クラス
 * メモリ内でジョブステータスを管理（将来的にはRedisやDBに移行可能）
 */
export class GenerationStatusManager {
  private static instance: GenerationStatusManager;
  private jobs: Map<string, GenerationJob> = new Map();
  private readonly MAX_JOBS = 1000; // メモリ制限のため最大ジョブ数を設定
  private readonly JOB_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24時間でジョブを削除

  private constructor() {
    // 定期的に古いジョブをクリーンアップ
    setInterval(() => this.cleanupOldJobs(), 60 * 60 * 1000); // 1時間ごと
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): GenerationStatusManager {
    if (!GenerationStatusManager.instance) {
      GenerationStatusManager.instance = new GenerationStatusManager();
    }
    return GenerationStatusManager.instance;
  }

  /**
   * 新しいジョブを作成
   */
  createJob(id: string, originalFileUrl?: string, metadata?: Record<string, any>): GenerationJob {
    // 最大ジョブ数を超えている場合は古いジョブを削除
    if (this.jobs.size >= this.MAX_JOBS) {
      this.cleanupOldJobs();
    }

    const job: GenerationJob = {
      id,
      status: GenerationStatus.PENDING,
      progress: 0,
      originalFileUrl,
      startedAt: new Date(),
      metadata,
    };

    this.jobs.set(id, job);
    logger.info('Generation job created', { jobId: id });
    return job;
  }

  /**
   * ジョブのステータスを更新
   */
  updateJob(
    id: string,
    updates: Partial<Omit<GenerationJob, 'id' | 'startedAt'>>
  ): GenerationJob | null {
    const job = this.jobs.get(id);
    if (!job) {
      logger.warn('Job not found for update', { jobId: id });
      return null;
    }

    // ステータスを更新
    Object.assign(job, updates);

    // 完了状態の場合は完了時刻を設定
    if (
      updates.status &&
      [GenerationStatus.COMPLETED, GenerationStatus.FAILED, GenerationStatus.CANCELLED].includes(
        updates.status
      )
    ) {
      job.completedAt = new Date();
    }

    logger.info('Generation job updated', {
      jobId: id,
      status: job.status,
      progress: job.progress,
    });

    return job;
  }

  /**
   * ジョブを取得
   */
  getJob(id: string): GenerationJob | null {
    return this.jobs.get(id) || null;
  }

  /**
   * ジョブを削除
   */
  deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    if (deleted) {
      logger.info('Generation job deleted', { jobId: id });
    }
    return deleted;
  }

  /**
   * すべてのジョブを取得（デバッグ用）
   */
  getAllJobs(): GenerationJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * ユーザーのジョブを取得（将来的な実装用）
   */
  getUserJobs(userId: string): GenerationJob[] {
    return Array.from(this.jobs.values()).filter(
      job => job.metadata?.userId === userId
    );
  }

  /**
   * ジョブの進捗を更新
   */
  updateProgress(id: string, progress: number, message?: string): GenerationJob | null {
    return this.updateJob(id, {
      progress: Math.min(100, Math.max(0, progress)),
      message,
      status: GenerationStatus.PROCESSING,
    });
  }

  /**
   * ジョブを成功として完了
   */
  completeJob(id: string, outputFileUrl: string, metadata?: Record<string, any>): GenerationJob | null {
    return this.updateJob(id, {
      status: GenerationStatus.COMPLETED,
      progress: 100,
      outputFileUrl,
      message: 'ファイル生成が完了しました',
      metadata: { ...this.getJob(id)?.metadata, ...metadata },
    });
  }

  /**
   * ジョブを失敗として完了
   */
  failJob(id: string, error: string, metadata?: Record<string, any>): GenerationJob | null {
    return this.updateJob(id, {
      status: GenerationStatus.FAILED,
      error,
      message: 'ファイル生成に失敗しました',
      metadata: { ...this.getJob(id)?.metadata, ...metadata },
    });
  }

  /**
   * ジョブをキャンセル
   */
  cancelJob(id: string): GenerationJob | null {
    return this.updateJob(id, {
      status: GenerationStatus.CANCELLED,
      message: 'ファイル生成がキャンセルされました',
    });
  }

  /**
   * 古いジョブをクリーンアップ
   */
  private cleanupOldJobs(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, job] of this.jobs.entries()) {
      const jobAge = now - job.startedAt.getTime();
      
      // 24時間以上経過したジョブを削除
      if (jobAge > this.JOB_EXPIRY_MS) {
        this.jobs.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old generation jobs`);
    }
  }

  /**
   * アクティブなジョブ数を取得
   */
  getActiveJobCount(): number {
    return Array.from(this.jobs.values()).filter(
      job => job.status === GenerationStatus.PROCESSING
    ).length;
  }

  /**
   * ジョブの統計情報を取得
   */
  getStatistics(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const jobs = Array.from(this.jobs.values());
    
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === GenerationStatus.PENDING).length,
      processing: jobs.filter(j => j.status === GenerationStatus.PROCESSING).length,
      completed: jobs.filter(j => j.status === GenerationStatus.COMPLETED).length,
      failed: jobs.filter(j => j.status === GenerationStatus.FAILED).length,
      cancelled: jobs.filter(j => j.status === GenerationStatus.CANCELLED).length,
    };
  }

  /**
   * ジョブの待機時間を推定（簡易版）
   */
  estimateWaitTime(jobId: string): number | null {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== GenerationStatus.PENDING) {
      return null;
    }

    // アクティブなジョブ数に基づいて待機時間を推定
    const activeJobs = this.getActiveJobCount();
    const avgProcessingTime = 30000; // 平均30秒と仮定
    
    return activeJobs * avgProcessingTime;
  }
}
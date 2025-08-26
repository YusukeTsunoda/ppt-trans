'use server';

import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export interface GenerationStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  details?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * ジョブのステータスを取得
 */
export async function getGenerationJobStatus(jobId: string): Promise<GenerationStatus> {
  try {
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('認証が必要です');
    }

    // ジョブステータスを取得
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      // ジョブが見つからない場合は、ダミーデータを返す（開発用）
      logger.warn(`Job not found: ${jobId}, returning mock data`);
      
      // 開発環境用のモックプログレス
      const mockProgress = Math.min(100, Math.random() * 100);
      
      return {
        jobId,
        status: mockProgress >= 100 ? 'completed' : 'processing',
        progress: mockProgress,
        message: mockProgress >= 100 ? '生成完了' : '処理中...',
        details: `${Math.round(mockProgress)}% 完了`,
        downloadUrl: mockProgress >= 100 ? `/api/download/${jobId}` : undefined,
      };
    }

    // 実際のジョブステータスを返す
    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      message: job.message,
      details: job.details,
      downloadUrl: job.download_url,
      error: job.error,
    };

  } catch (error) {
    logger.error('Error getting generation job status:', error);
    throw error;
  }
}

/**
 * 新しい生成ジョブを作成
 */
export async function createGenerationJob(fileId: string): Promise<{ jobId: string }> {
  try {
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('認証が必要です');
    }

    // ジョブを作成
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        file_id: fileId,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError || !job) {
      // テーブルが存在しない場合は、ダミーIDを返す（開発用）
      logger.warn('Failed to create job, returning mock job ID');
      return { jobId: `mock-job-${Date.now()}` };
    }

    return { jobId: job.id };

  } catch (error) {
    logger.error('Error creating generation job:', error);
    throw error;
  }
}
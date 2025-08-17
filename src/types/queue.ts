/**
 * Queue関連の型定義
 */

import type { JsonObject, ProcessingStatus } from './common';

// 基本的なジョブの型
export interface QueueJob<T = unknown> {
  id: string;
  data: T;
  status: ProcessingStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  metadata?: JsonObject;
}

// PPTXジョブ用のデータ型
export interface PPTXJobData {
  fileId: string;
  filePath: string;
  userId: string;
  originalFileName: string;
  targetLanguage: string;
  options?: {
    preserveFormat?: boolean;
    batchSize?: number;
    model?: string;
  };
}

// 翻訳ジョブ用のデータ型
export interface TranslationJobData {
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  model: string;
  userId: string;
  context?: string;
}

// ジョブの進捗情報
export interface JobProgress {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  details?: JsonObject;
}

// キューの統計情報
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// キューの設定
export interface QueueConfig {
  name: string;
  concurrency: number;
  defaultJobOptions: {
    maxAttempts: number;
    timeout: number;
    priority: number;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

// ジョブイベントの型
export type JobEventType = 
  | 'created'
  | 'started' 
  | 'progress'
  | 'completed'
  | 'failed'
  | 'retry'
  | 'cancelled';

export interface JobEvent<T = unknown> {
  type: JobEventType;
  jobId: string;
  timestamp: Date;
  data?: T;
  error?: string;
}
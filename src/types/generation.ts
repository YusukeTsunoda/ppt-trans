/**
 * 生成処理関連の型定義
 */

import type { JsonObject, ProcessingStatus, FileInfo } from './common';

// 生成ステータスの詳細型
export interface GenerationStatus {
  state: ProcessingStatus;
  progress: number;
  message?: string;
  currentStep?: string;
  totalSteps?: number;
  estimatedTimeRemaining?: number;
}

// 生成メタデータ
export interface GenerationMetadata {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  fileCount?: number;
  totalSize?: number;
  processedSize?: number;
  errors?: string[];
  warnings?: string[];
  performance?: {
    memoryUsage: number;
    cpuUsage: number;
    processingSpeed: number;
  };
}

// 生成オプション
export interface GenerationOptions {
  outputFormat?: string;
  quality?: 'low' | 'medium' | 'high';
  compression?: boolean;
  preserveMetadata?: boolean;
  customSettings?: JsonObject;
}

// 生成結果
export interface GenerationResult {
  success: boolean;
  outputFiles: FileInfo[];
  metadata: GenerationMetadata;
  logs?: string[];
  errors?: string[];
}

// 生成リクエスト
export interface GenerationRequest {
  id: string;
  userId: string;
  inputFiles: FileInfo[];
  options: GenerationOptions;
  priority?: number;
  callback?: string;
}

// 生成セッション
export interface GenerationSession {
  id: string;
  request: GenerationRequest;
  status: GenerationStatus;
  metadata: GenerationMetadata;
  result?: GenerationResult;
  createdAt: Date;
  updatedAt: Date;
}

// バッチ生成用の型
export interface BatchGenerationRequest {
  sessionId: string;
  requests: GenerationRequest[];
  batchOptions?: {
    parallelProcessing?: boolean;
    maxConcurrency?: number;
    stopOnError?: boolean;
  };
}

// 生成イベント
export type GenerationEventType = 
  | 'started'
  | 'progress'
  | 'step_completed'
  | 'warning'
  | 'error'
  | 'completed'
  | 'cancelled';

export interface GenerationEvent {
  type: GenerationEventType;
  sessionId: string;
  timestamp: Date;
  data?: JsonObject;
  message?: string;
}
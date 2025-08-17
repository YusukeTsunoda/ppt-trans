/**
 * 共通型定義
 * any型を排除するための基本的な型定義を提供
 */

// 汎用的なJSON値の型定義
export type JsonValue = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined
  | JsonObject 
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = Array<JsonValue>;

// APIレスポンスの共通型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

// APIエラーの型定義
export interface ApiError {
  code: string;
  message: string;
  details?: JsonObject;
  stack?: string;
}

// ページネーションパラメータ
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// ページネーションレスポンス
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 共通のイベント型
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  metadata?: JsonObject;
}

// ファイル関連の型
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: Date;
  path?: string;
  url?: string;
}

// 処理ステータスの型
export type ProcessingStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// 処理結果の型
export interface ProcessingResult<T = unknown> {
  status: ProcessingStatus;
  data?: T;
  error?: ApiError;
  progress?: number;
  startTime?: Date;
  endTime?: Date;
}
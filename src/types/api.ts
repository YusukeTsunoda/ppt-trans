/**
 * API関連の型定義
 */

import type { JsonObject, ApiResponse, ApiError } from './common';

// HTTPメソッド
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// リクエストオプション
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

// APIクライアントの設定
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
}

// リクエストインターセプター
export type RequestInterceptor = (
  url: string, 
  options: RequestOptions
) => Promise<{ url: string; options: RequestOptions }>;

// レスポンスインターセプター
export type ResponseInterceptor<T = unknown> = (
  response: ApiResponse<T>
) => Promise<ApiResponse<T>>;

// エラーハンドラー
export type ErrorHandler = (error: ApiError) => Promise<ApiError | never>;

// API エンドポイントの型定義
export interface ApiEndpoints {
  // 認証関連
  auth: {
    login: { method: 'POST'; body: { email: string; password: string } };
    logout: { method: 'POST' };
    refresh: { method: 'POST'; body: { refreshToken: string } };
  };
  
  // ファイル関連
  files: {
    upload: { method: 'POST'; body: FormData };
    list: { method: 'GET'; params?: { page?: number; limit?: number } };
    delete: { method: 'DELETE'; params: { id: string } };
  };
  
  // 翻訳関連
  translation: {
    translate: { method: 'POST'; body: { text: string; targetLanguage: string } };
    status: { method: 'GET'; params: { id: string } };
  };
}

// API キーの型
export type ApiEndpointKey = keyof ApiEndpoints;
export type ApiActionKey<T extends ApiEndpointKey> = keyof ApiEndpoints[T];
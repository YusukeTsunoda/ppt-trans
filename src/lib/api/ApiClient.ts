/**
 * APIクライアントラッパー
 * 統一されたエラーハンドリングとリトライロジックを提供
 */

import { AppError, normalizeError } from '../errors/AppError';
import { ErrorCodes, isRetryableError } from '../errors/ErrorCodes';
import logger from '../logger';

/**
 * APIリクエストオプション
 */
export interface ApiRequestOptions extends RequestInit {
  url: string;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  requireAuth?: boolean;
}

/**
 * APIレスポンス型
 */
export interface ApiResponse<T = any> {
  data?: T;
  error?: AppError;
  status: number;
  headers: Headers;
}

/**
 * リトライ設定
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

/**
 * APIクライアントクラス
 */
export class ApiClient {
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  };

  private defaultTimeout = 30000; // 30秒

  /**
   * APIリクエストを実行
   */
  async request<T = any>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
    const {
      url,
      retries = this.defaultRetryConfig.maxRetries,
      retryDelay = this.defaultRetryConfig.initialDelay,
      timeout = this.defaultTimeout,
      requireAuth = false,
      ...fetchOptions
    } = options;

    // 認証ヘッダーの追加
    if (requireAuth) {
      fetchOptions.headers = {
        ...fetchOptions.headers,
        // 認証トークンはNext.jsのミドルウェアで自動的に追加される
      };
    }

    // リトライロジック
    let lastError: AppError | undefined;
    let currentDelay = retryDelay;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.executeRequest(url, fetchOptions, timeout);
        
        // 成功レスポンス
        if (response.ok) {
          const data = await this.parseResponse<T>(response);
          return {
            data,
            status: response.status,
            headers: response.headers,
          };
        }

        // エラーレスポンス
        const error = await this.handleErrorResponse(response);
        
        // リトライ可能なエラーかチェック
        if (attempt < retries && isRetryableError(error.code as any)) {
          lastError = error;
          await this.delay(currentDelay);
          currentDelay = Math.min(currentDelay * this.defaultRetryConfig.backoffFactor, this.defaultRetryConfig.maxDelay);
          
          logger.info(`Retrying request (attempt ${attempt + 1}/${retries})`, {
            url,
            error: error.code,
            delay: currentDelay,
          });
          
          continue;
        }

        // リトライ不可またはリトライ回数超過
        throw error;

      } catch (error) {
        // ネットワークエラーなど
        const appError = this.handleNetworkError(error);
        
        if (attempt < retries && isRetryableError(appError.code as any)) {
          lastError = appError;
          await this.delay(currentDelay);
          currentDelay = Math.min(currentDelay * this.defaultRetryConfig.backoffFactor, this.defaultRetryConfig.maxDelay);
          
          logger.info(`Retrying request after network error (attempt ${attempt + 1}/${retries})`, {
            url,
            error: appError.code,
            delay: currentDelay,
          });
          
          continue;
        }

        throw appError;
      }
    }

    // すべてのリトライが失敗
    throw lastError || new AppError(
      'All retry attempts failed',
      ErrorCodes.NETWORK_ERROR,
      503,
      false,
      'リクエストの処理に失敗しました'
    );
  }

  /**
   * GETリクエスト
   */
  async get<T = any>(url: string, options?: Partial<ApiRequestOptions>): Promise<T> {
    const response = await this.request<T>({
      ...options,
      url,
      method: 'GET',
    });

    if (response.error) {
      throw response.error;
    }

    return response.data!;
  }

  /**
   * POSTリクエスト
   */
  async post<T = any>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<T> {
    const response = await this.request<T>({
      ...options,
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (response.error) {
      throw response.error;
    }

    return response.data!;
  }

  /**
   * PUTリクエスト
   */
  async put<T = any>(url: string, data?: any, options?: Partial<ApiRequestOptions>): Promise<T> {
    const response = await this.request<T>({
      ...options,
      url,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (response.error) {
      throw response.error;
    }

    return response.data!;
  }

  /**
   * DELETEリクエスト
   */
  async delete<T = any>(url: string, options?: Partial<ApiRequestOptions>): Promise<T> {
    const response = await this.request<T>({
      ...options,
      url,
      method: 'DELETE',
    });

    if (response.error) {
      throw response.error;
    }

    return response.data!;
  }

  /**
   * ファイルアップロード
   */
  async uploadFile<T = any>(
    url: string,
    file: File,
    additionalData?: Record<string, any>,
    options?: Partial<ApiRequestOptions>
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await this.request<T>({
      ...options,
      url,
      method: 'POST',
      body: formData,
      // Content-Typeヘッダーは設定しない（ブラウザが自動設定）
    });

    if (response.error) {
      throw response.error;
    }

    return response.data!;
  }

  /**
   * 実際のHTTPリクエストを実行
   */
  private async executeRequest(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          'Request timeout',
          ErrorCodes.NETWORK_TIMEOUT,
          504,
          true,
          'リクエストがタイムアウトしました'
        );
      }

      throw error;
    }
  }

  /**
   * レスポンスを解析
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    if (contentType?.includes('text/')) {
      return await response.text() as any;
    }

    // バイナリデータ
    return await response.blob() as any;
  }

  /**
   * エラーレスポンスを処理
   */
  private async handleErrorResponse(response: Response): Promise<AppError> {
    let errorData: any = {};

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
      }
    } catch {
      // JSONパースエラーは無視
    }

    // AppErrorフォーマットの場合
    if (errorData.code && errorData.message) {
      return new AppError(
        errorData.message,
        errorData.code,
        response.status,
        true,
        errorData.userMessage || errorData.error,
        errorData.details
      );
    }

    // 一般的なHTTPエラー
    return this.createHttpError(response.status, errorData.error || errorData.message);
  }

  /**
   * ネットワークエラーを処理
   */
  private handleNetworkError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new AppError(
        'Network request failed',
        ErrorCodes.NETWORK_ERROR,
        0,
        true,
        'ネットワークエラーが発生しました'
      );
    }

    return normalizeError(error);
  }

  /**
   * HTTPステータスコードからエラーを作成
   */
  private createHttpError(status: number, message?: string): AppError {
    const statusMessages: Record<number, { code: string; message: string }> = {
      400: { code: ErrorCodes.VALIDATION_INVALID_FORMAT, message: 'リクエストが正しくありません' },
      401: { code: ErrorCodes.AUTH_TOKEN_INVALID, message: '認証が必要です' },
      403: { code: ErrorCodes.AUTH_UNAUTHORIZED, message: 'アクセス権限がありません' },
      404: { code: ErrorCodes.FILE_NOT_FOUND, message: 'リソースが見つかりません' },
      429: { code: ErrorCodes.RATE_LIMIT_EXCEEDED, message: 'リクエスト数が制限を超えました' },
      500: { code: ErrorCodes.INTERNAL_SERVER_ERROR, message: 'サーバーエラーが発生しました' },
      502: { code: ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE, message: '外部サービスが利用できません' },
      503: { code: ErrorCodes.SERVICE_UNAVAILABLE, message: 'サービスが一時的に利用できません' },
      504: { code: ErrorCodes.NETWORK_TIMEOUT, message: 'リクエストがタイムアウトしました' },
    };

    const errorInfo = statusMessages[status] || {
      code: ErrorCodes.UNKNOWN_ERROR,
      message: 'エラーが発生しました',
    };

    return new AppError(
      message || `HTTP ${status} error`,
      errorInfo.code,
      status,
      true,
      errorInfo.message
    );
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// シングルトンインスタンス
const apiClient = new ApiClient();

export default apiClient;

/**
 * カスタムフック用のラッパー関数
 */
export function useApiClient(): ApiClient {
  return apiClient;
}
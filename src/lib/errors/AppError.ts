/**
 * アプリケーション全体で使用する統一エラークラス
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly userMessage: string;
  public readonly details?: unknown;
  public readonly metadata?: unknown;  // detailsのエイリアス
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    userMessage?: string,
    details?: unknown
  ) {
    super(message);
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.userMessage = userMessage || message;
    this.details = details;
    this.metadata = details;  // detailsをmetadataとしても公開
    this.timestamp = new Date();
  }

  /**
   * エラーがリトライ可能かどうかを判定
   */
  isRetryable(): boolean {
    // ネットワークエラーやタイムアウトはリトライ可能
    return this.code.includes('NETWORK') || 
           this.code.includes('TIMEOUT') ||
           this.statusCode >= 500;
  }

  /**
   * エラーをログ用のオブジェクトに変換
   */
  toLogObject(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack,
      details: this.details
    };
  }

  /**
   * クライアントに返すエラーレスポンス
   */
  toClientResponse(): Record<string, unknown> {
    return {
      error: this.userMessage,
      code: this.code,
      timestamp: this.timestamp,
      // 開発環境でのみ詳細情報を含める
      ...(process.env.NODE_ENV === 'development' && {
        details: this.details,
        stack: this.stack
      })
    };
  }
}

/**
 * 一般的なエラーをAppErrorに変換
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      false,
      'システムエラーが発生しました'
    );
  }

  return new AppError(
    String(error),
    'UNKNOWN_ERROR',
    500,
    false,
    'システムエラーが発生しました'
  );
}
/**
 * Structured error classes for Server Actions
 * Provides consistent error handling and user-friendly messages
 */

/**
 * Base error class for application errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    // Map technical errors to user-friendly messages
    const userMessages: Record<string, string> = {
      'AUTH_REQUIRED': '認証が必要です。ログインしてください。',
      'AUTH_EXPIRED': 'セッションの有効期限が切れました。再度ログインしてください。',
      'PERMISSION_DENIED': 'この操作を実行する権限がありません。',
      'FILE_NOT_FOUND': 'ファイルが見つかりません。',
      'FILE_ACCESS_DENIED': 'このファイルへのアクセス権限がありません。',
      'INVALID_FILE_FORMAT': 'サポートされていないファイル形式です。',
      'FILE_TOO_LARGE': 'ファイルサイズが大きすぎます。',
      'RATE_LIMIT_EXCEEDED': 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
      'INVALID_INPUT': '入力データが正しくありません。',
      'TRANSLATION_FAILED': '翻訳処理に失敗しました。再度お試しください。',
      'NETWORK_ERROR': 'ネットワークエラーが発生しました。接続を確認してください。',
      'SERVER_ERROR': 'サーバーエラーが発生しました。しばらく待ってから再試行してください。',
      'VALIDATION_ERROR': '入力内容を確認してください。',
      'PROCESSING_ERROR': '処理中にエラーが発生しました。',
      'TIMEOUT_ERROR': '処理がタイムアウトしました。',
    };

    return userMessages[this.code] || this.message;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.getUserMessage(),
      statusCode: this.statusCode,
      details: this.details,
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        originalMessage: this.message,
      }),
    };
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super(message, 'AUTH_REQUIRED', 401, true, details);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Permission denied', details?: Record<string, any>) {
    super(message, 'PERMISSION_DENIED', 403, true, details);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource', details?: Record<string, any>) {
    super(`${resource} not found`, 'NOT_FOUND', 404, true, details);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number, details?: Record<string, any>) {
    const message = retryAfter 
      ? `Rate limit exceeded. Retry after ${retryAfter} seconds`
      : 'Rate limit exceeded';
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, { retryAfter, ...details });
  }
}

/**
 * File processing error
 */
export class FileProcessingError extends AppError {
  constructor(message: string = 'File processing failed', details?: Record<string, any>) {
    super(message, 'FILE_PROCESSING_ERROR', 422, true, details);
  }
}

/**
 * Translation error
 */
export class TranslationError extends AppError {
  constructor(message: string = 'Translation failed', details?: Record<string, any>) {
    super(message, 'TRANSLATION_FAILED', 500, true, details);
  }
}

/**
 * Network error
 */
export class NetworkError extends AppError {
  constructor(message: string = 'Network error occurred', details?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', 503, true, details);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AppError {
  constructor(message: string = 'Operation timed out', details?: Record<string, any>) {
    super(message, 'TIMEOUT_ERROR', 504, true, details);
  }
}

/**
 * Error handler for Server Actions
 */
export function handleServerActionError(error: unknown): {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, any>;
} {
  // If it's already an AppError, use its user message
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.getUserMessage(),
      code: error.code,
      details: error.details,
    };
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
    return {
      success: false,
      error: '入力データが正しくありません。',
      code: 'VALIDATION_ERROR',
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('rate limit')) {
      return {
        success: false,
        error: 'リクエスト制限に達しました。しばらく待ってから再試行してください。',
        code: 'RATE_LIMIT_EXCEEDED',
      };
    }

    if (error.message.includes('network') || error.message.includes('fetch')) {
      return {
        success: false,
        error: 'ネットワークエラーが発生しました。接続を確認してください。',
        code: 'NETWORK_ERROR',
      };
    }

    if (error.message.includes('timeout')) {
      return {
        success: false,
        error: '処理がタイムアウトしました。',
        code: 'TIMEOUT_ERROR',
      };
    }

    // Development mode: return original error
    if (process.env.NODE_ENV === 'development') {
      return {
        success: false,
        error: error.message,
        code: 'UNKNOWN_ERROR',
      };
    }
  }

  // Default error for production
  return {
    success: false,
    error: 'エラーが発生しました。しばらく待ってから再試行してください。',
    code: 'UNKNOWN_ERROR',
  };
}
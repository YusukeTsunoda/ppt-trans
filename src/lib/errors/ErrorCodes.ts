/**
 * アプリケーション全体で使用するエラーコード定義
 */

/**
 * エラーカテゴリ
 */
export enum ErrorCategory {
  // クライアントエラー (4xx)
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTH',
  AUTHORIZATION = 'AUTHZ',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // サーバーエラー (5xx)
  INTERNAL = 'INTERNAL',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL',
  
  // ネットワークエラー (6xx)
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  
  // ビジネスロジックエラー (7xx)
  FILE_PROCESSING = 'FILE',
  TRANSLATION = 'TRANSLATION',
  RATE_LIMIT = 'RATE_LIMIT',
  QUOTA = 'QUOTA',
}

/**
 * エラーコード定義
 */
export const ErrorCodes = {
  // 認証・認可エラー (400-409)
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_TOKEN_EXPIRED: 'AUTH_002',
  AUTH_TOKEN_INVALID: 'AUTH_003',
  AUTH_UNAUTHORIZED: 'AUTH_004',
  AUTH_SESSION_EXPIRED: 'AUTH_005',
  AUTH_USER_NOT_FOUND: 'AUTH_006',
  AUTH_ACCOUNT_LOCKED: 'AUTH_007',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_008',
  
  // バリデーションエラー (410-419)
  VALIDATION_REQUIRED_FIELD: 'VAL_001',
  VALIDATION_INVALID_FORMAT: 'VAL_002',
  VALIDATION_INVALID_EMAIL: 'VAL_003',
  VALIDATION_INVALID_PASSWORD: 'VAL_004',
  VALIDATION_FIELD_TOO_LONG: 'VAL_005',
  VALIDATION_FIELD_TOO_SHORT: 'VAL_006',
  VALIDATION_INVALID_FILE_TYPE: 'VAL_007',
  VALIDATION_FILE_TOO_LARGE: 'VAL_008',
  
  // ファイル処理エラー (420-429)
  FILE_UPLOAD_FAILED: 'FILE_001',
  FILE_NOT_FOUND: 'FILE_002',
  FILE_PROCESSING_FAILED: 'FILE_003',
  FILE_INVALID_FORMAT: 'FILE_004',
  FILE_CORRUPTED: 'FILE_005',
  FILE_TOO_MANY_SLIDES: 'FILE_006',
  FILE_EMPTY: 'FILE_007',
  FILE_PERMISSION_DENIED: 'FILE_008',
  FILE_DELETE_FAILED: 'FILE_009',
  FILE_LIST_FAILED: 'FILE_010',
  
  // 翻訳エラー (430-439)
  TRANSLATION_FAILED: 'TRANS_001',
  TRANSLATION_TIMEOUT: 'TRANS_002',
  TRANSLATION_UNSUPPORTED_LANGUAGE: 'TRANS_003',
  TRANSLATION_EMPTY_TEXT: 'TRANS_004',
  TRANSLATION_API_ERROR: 'TRANS_005',
  TRANSLATION_QUOTA_EXCEEDED: 'TRANS_006',
  TRANSLATION_RATE_LIMITED: 'TRANS_007',
  
  // データベースエラー (500-509)
  DATABASE_CONNECTION_FAILED: 'DB_001',
  DATABASE_QUERY_FAILED: 'DB_002',
  DATABASE_TRANSACTION_FAILED: 'DB_003',
  DATABASE_CONSTRAINT_VIOLATION: 'DB_004',
  DATABASE_DEADLOCK: 'DB_005',
  DATABASE_TIMEOUT: 'DB_006',
  
  // 外部サービスエラー (510-519)
  EXTERNAL_API_ERROR: 'EXT_001',
  EXTERNAL_API_TIMEOUT: 'EXT_002',
  EXTERNAL_API_RATE_LIMITED: 'EXT_003',
  EXTERNAL_API_UNAUTHORIZED: 'EXT_004',
  EXTERNAL_SERVICE_UNAVAILABLE: 'EXT_005',
  
  // ネットワークエラー (600-609)
  NETWORK_ERROR: 'NET_001',
  NETWORK_TIMEOUT: 'NET_002',
  NETWORK_CONNECTION_LOST: 'NET_003',
  NETWORK_DNS_FAILED: 'NET_004',
  
  // レート制限エラー (700-709)
  RATE_LIMIT_EXCEEDED: 'RATE_001',
  DAILY_QUOTA_EXCEEDED: 'RATE_002',
  MONTHLY_QUOTA_EXCEEDED: 'RATE_003',
  CONCURRENT_REQUEST_LIMIT: 'RATE_004',
  
  // セキュリティエラー (800-809)
  SECURITY_FILE_VALIDATION_FAILED: 'SEC_001',
  SECURITY_CSRF_TOKEN_INVALID: 'SEC_002',
  SECURITY_RATE_LIMIT_EXCEEDED: 'SEC_003',
  SECURITY_XSS_DETECTED: 'SEC_004',
  SECURITY_SQL_INJECTION_DETECTED: 'SEC_005',
  
  // システムエラー (900-999)
  INTERNAL_SERVER_ERROR: 'SYS_001',
  SERVICE_UNAVAILABLE: 'SYS_002',
  CONFIGURATION_ERROR: 'SYS_003',
  UNKNOWN_ERROR: 'SYS_999',
} as const;

/**
 * エラーコードの型定義
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * エラーコードとHTTPステータスコードのマッピング
 */
export const ErrorStatusMap: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 400,
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 400,
  [ErrorCodes.VALIDATION_INVALID_PASSWORD]: 400,
  [ErrorCodes.VALIDATION_FIELD_TOO_LONG]: 400,
  [ErrorCodes.VALIDATION_FIELD_TOO_SHORT]: 400,
  [ErrorCodes.VALIDATION_INVALID_FILE_TYPE]: 400,
  [ErrorCodes.VALIDATION_FILE_TOO_LARGE]: 400,
  [ErrorCodes.TRANSLATION_EMPTY_TEXT]: 400,
  
  // 401 Unauthorized
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCodes.EXTERNAL_API_UNAUTHORIZED]: 401,
  
  // 403 Forbidden
  [ErrorCodes.AUTH_UNAUTHORIZED]: 403,
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 403,
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: 403,
  [ErrorCodes.FILE_PERMISSION_DENIED]: 403,
  [ErrorCodes.FILE_DELETE_FAILED]: 403,
  [ErrorCodes.FILE_LIST_FAILED]: 403,
  
  // 404 Not Found
  [ErrorCodes.AUTH_USER_NOT_FOUND]: 404,
  [ErrorCodes.FILE_NOT_FOUND]: 404,
  
  // 409 Conflict
  [ErrorCodes.DATABASE_CONSTRAINT_VIOLATION]: 409,
  [ErrorCodes.DATABASE_DEADLOCK]: 409,
  
  // 413 Payload Too Large
  [ErrorCodes.FILE_TOO_MANY_SLIDES]: 413,
  
  // 422 Unprocessable Entity
  [ErrorCodes.FILE_INVALID_FORMAT]: 422,
  [ErrorCodes.FILE_CORRUPTED]: 422,
  [ErrorCodes.FILE_EMPTY]: 422,
  [ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE]: 422,
  [ErrorCodes.SECURITY_FILE_VALIDATION_FAILED]: 422,
  [ErrorCodes.SECURITY_CSRF_TOKEN_INVALID]: 422,
  [ErrorCodes.SECURITY_XSS_DETECTED]: 422,
  [ErrorCodes.SECURITY_SQL_INJECTION_DETECTED]: 422,
  
  // 429 Too Many Requests
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCodes.DAILY_QUOTA_EXCEEDED]: 429,
  [ErrorCodes.MONTHLY_QUOTA_EXCEEDED]: 429,
  [ErrorCodes.CONCURRENT_REQUEST_LIMIT]: 429,
  [ErrorCodes.TRANSLATION_RATE_LIMITED]: 429,
  [ErrorCodes.EXTERNAL_API_RATE_LIMITED]: 429,
  [ErrorCodes.SECURITY_RATE_LIMIT_EXCEEDED]: 429,
  
  // 500 Internal Server Error
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.FILE_UPLOAD_FAILED]: 500,
  [ErrorCodes.FILE_PROCESSING_FAILED]: 500,
  [ErrorCodes.TRANSLATION_FAILED]: 500,
  [ErrorCodes.DATABASE_CONNECTION_FAILED]: 500,
  [ErrorCodes.DATABASE_QUERY_FAILED]: 500,
  [ErrorCodes.DATABASE_TRANSACTION_FAILED]: 500,
  [ErrorCodes.EXTERNAL_API_ERROR]: 500,
  [ErrorCodes.NETWORK_ERROR]: 500,
  [ErrorCodes.CONFIGURATION_ERROR]: 500,
  [ErrorCodes.UNKNOWN_ERROR]: 500,
  
  // 502 Bad Gateway
  [ErrorCodes.NETWORK_DNS_FAILED]: 502,
  
  // 503 Service Unavailable
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.NETWORK_CONNECTION_LOST]: 503,
  
  // 500 Internal Server Error (continued)
  [ErrorCodes.TRANSLATION_API_ERROR]: 500,
  
  // 504 Gateway Timeout
  [ErrorCodes.TRANSLATION_TIMEOUT]: 504,
  [ErrorCodes.DATABASE_TIMEOUT]: 504,
  [ErrorCodes.EXTERNAL_API_TIMEOUT]: 504,
  [ErrorCodes.NETWORK_TIMEOUT]: 504,
  
  // 507 Insufficient Storage
  [ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]: 507,
};

/**
 * エラーコードがリトライ可能かどうかを判定
 */
export function isRetryableError(code: ErrorCode): boolean {
  const retryableCodes: ErrorCode[] = [
    ErrorCodes.NETWORK_ERROR,
    ErrorCodes.NETWORK_TIMEOUT,
    ErrorCodes.NETWORK_CONNECTION_LOST,
    ErrorCodes.DATABASE_TIMEOUT,
    ErrorCodes.DATABASE_DEADLOCK,
    ErrorCodes.EXTERNAL_API_TIMEOUT,
    ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE,
    ErrorCodes.SERVICE_UNAVAILABLE,
    ErrorCodes.TRANSLATION_TIMEOUT,
  ];
  
  return retryableCodes.includes(code);
}

/**
 * エラーコードがユーザー操作で解決可能かどうかを判定
 */
export function isUserRecoverableError(code: ErrorCode): boolean {
  const userRecoverableCodes: ErrorCode[] = [
    ErrorCodes.VALIDATION_REQUIRED_FIELD,
    ErrorCodes.VALIDATION_INVALID_FORMAT,
    ErrorCodes.VALIDATION_INVALID_EMAIL,
    ErrorCodes.VALIDATION_INVALID_PASSWORD,
    ErrorCodes.VALIDATION_FIELD_TOO_LONG,
    ErrorCodes.VALIDATION_FIELD_TOO_SHORT,
    ErrorCodes.VALIDATION_INVALID_FILE_TYPE,
    ErrorCodes.VALIDATION_FILE_TOO_LARGE,
    ErrorCodes.AUTH_INVALID_CREDENTIALS,
    ErrorCodes.FILE_INVALID_FORMAT,
    ErrorCodes.FILE_TOO_MANY_SLIDES,
    ErrorCodes.FILE_EMPTY,
    ErrorCodes.TRANSLATION_EMPTY_TEXT,
    ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE,
  ];
  
  return userRecoverableCodes.includes(code);
}

/**
 * エラーカテゴリからエラーコードを取得
 */
export function getErrorCategory(code: ErrorCode): ErrorCategory {
  if (code.startsWith('AUTH')) return ErrorCategory.AUTHENTICATION;
  if (code.startsWith('VAL')) return ErrorCategory.VALIDATION;
  if (code.startsWith('FILE')) return ErrorCategory.FILE_PROCESSING;
  if (code.startsWith('TRANS')) return ErrorCategory.TRANSLATION;
  if (code.startsWith('DB')) return ErrorCategory.DATABASE;
  if (code.startsWith('EXT')) return ErrorCategory.EXTERNAL_SERVICE;
  if (code.startsWith('NET')) return ErrorCategory.NETWORK;
  if (code.startsWith('RATE')) return ErrorCategory.RATE_LIMIT;
  if (code.startsWith('SEC')) return ErrorCategory.VALIDATION; // Security errors are treated as validation
  if (code.startsWith('SYS')) return ErrorCategory.INTERNAL;
  
  return ErrorCategory.INTERNAL;
}
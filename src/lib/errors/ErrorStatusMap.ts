/**
 * エラーコードとHTTPステータスコードのマッピング
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';

export const ErrorStatusMap: Partial<Record<ErrorCode, number>> = {
  // 認証・認可エラー（401, 403）
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCodes.AUTH_TOKEN_INVALID]: 401,
  [ErrorCodes.AUTH_UNAUTHORIZED]: 403,
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCodes.AUTH_USER_NOT_FOUND]: 404,
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 403,
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: 403,
  
  // バリデーションエラー（400）
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: 400,
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: 400,
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 400,
  [ErrorCodes.VALIDATION_INVALID_PASSWORD]: 400,
  [ErrorCodes.VALIDATION_FIELD_TOO_LONG]: 400,
  [ErrorCodes.VALIDATION_FIELD_TOO_SHORT]: 400,
  [ErrorCodes.VALIDATION_INVALID_FILE_TYPE]: 400,
  [ErrorCodes.VALIDATION_FILE_TOO_LARGE]: 413,
  
  // ファイル処理エラー（400, 404, 500）
  [ErrorCodes.FILE_UPLOAD_FAILED]: 500,
  [ErrorCodes.FILE_NOT_FOUND]: 404,
  [ErrorCodes.FILE_PROCESSING_FAILED]: 500,
  [ErrorCodes.FILE_INVALID_FORMAT]: 400,
  [ErrorCodes.FILE_CORRUPTED]: 422,
  [ErrorCodes.FILE_TOO_MANY_SLIDES]: 400,
  [ErrorCodes.FILE_EMPTY]: 400,
  [ErrorCodes.FILE_PERMISSION_DENIED]: 403,
  [ErrorCodes.FILE_DELETE_FAILED]: 500,
  [ErrorCodes.FILE_LIST_FAILED]: 500,
  
  // 翻訳エラー（400, 429, 500, 503）
  [ErrorCodes.TRANSLATION_FAILED]: 500,
  [ErrorCodes.TRANSLATION_TIMEOUT]: 504,
  [ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE]: 400,
  [ErrorCodes.TRANSLATION_EMPTY_TEXT]: 400,
  [ErrorCodes.TRANSLATION_API_ERROR]: 503,
  [ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]: 402,
  [ErrorCodes.TRANSLATION_RATE_LIMITED]: 429,
  
  // その他のエラー（デフォルト: 500）
  [ErrorCodes.CONFIGURATION_ERROR]: 500,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.UNKNOWN_ERROR]: 500,
};
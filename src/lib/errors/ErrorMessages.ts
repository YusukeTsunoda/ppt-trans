/**
 * エラーメッセージのマッピング定義
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';

/**
 * エラーメッセージの型定義
 */
interface ErrorMessage {
  ja: string;
  en: string;
  recovery?: {
    ja: string;
    en: string;
    steps?: string[];
  };
}

/**
 * エラーコードとメッセージのマッピング
 */
export const ErrorMessages: Record<ErrorCode, ErrorMessage> = {
  // 認証・認可エラー
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: {
    ja: 'メールアドレスまたはパスワードが正しくありません',
    en: 'Invalid email or password',
    recovery: {
      ja: 'メールアドレスとパスワードを確認して、もう一度お試しください',
      en: 'Please check your email and password and try again'
    }
  },
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: {
    ja: 'セッションの有効期限が切れました',
    en: 'Your session has expired',
    recovery: {
      ja: '再度ログインしてください',
      en: 'Please log in again'
    }
  },
  [ErrorCodes.AUTH_TOKEN_INVALID]: {
    ja: '無効な認証トークンです',
    en: 'Invalid authentication token',
    recovery: {
      ja: '再度ログインしてください',
      en: 'Please log in again'
    }
  },
  [ErrorCodes.AUTH_UNAUTHORIZED]: {
    ja: 'この操作を実行する権限がありません',
    en: 'You do not have permission to perform this action',
  },
  [ErrorCodes.AUTH_SESSION_EXPIRED]: {
    ja: 'セッションの有効期限が切れました',
    en: 'Your session has expired',
    recovery: {
      ja: '再度ログインしてください',
      en: 'Please log in again'
    }
  },
  [ErrorCodes.AUTH_USER_NOT_FOUND]: {
    ja: 'ユーザーが見つかりません',
    en: 'User not found',
  },
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: {
    ja: 'アカウントがロックされています',
    en: 'Your account has been locked',
    recovery: {
      ja: 'サポートにお問い合わせください',
      en: 'Please contact support'
    }
  },
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: {
    ja: 'メールアドレスが確認されていません',
    en: 'Email address not verified',
    recovery: {
      ja: '確認メールをご確認ください',
      en: 'Please check your verification email'
    }
  },

  // バリデーションエラー
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: {
    ja: '必須項目が入力されていません',
    en: 'Required field is missing',
    recovery: {
      ja: 'すべての必須項目を入力してください',
      en: 'Please fill in all required fields'
    }
  },
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: {
    ja: '入力形式が正しくありません',
    en: 'Invalid input format',
    recovery: {
      ja: '正しい形式で入力してください',
      en: 'Please enter in the correct format'
    }
  },
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: {
    ja: '有効なメールアドレスを入力してください',
    en: 'Please enter a valid email address',
  },
  [ErrorCodes.VALIDATION_INVALID_PASSWORD]: {
    ja: 'パスワードは8文字以上で、英数字を含む必要があります',
    en: 'Password must be at least 8 characters with letters and numbers',
  },
  [ErrorCodes.VALIDATION_FIELD_TOO_LONG]: {
    ja: '入力内容が長すぎます',
    en: 'Input is too long',
  },
  [ErrorCodes.VALIDATION_FIELD_TOO_SHORT]: {
    ja: '入力内容が短すぎます',
    en: 'Input is too short',
  },
  [ErrorCodes.VALIDATION_INVALID_FILE_TYPE]: {
    ja: 'サポートされていないファイル形式です',
    en: 'Unsupported file type',
    recovery: {
      ja: 'PPTXファイルをアップロードしてください',
      en: 'Please upload a PPTX file'
    }
  },
  [ErrorCodes.VALIDATION_FILE_TOO_LARGE]: {
    ja: 'ファイルサイズが大きすぎます（最大50MB）',
    en: 'File size is too large (max 50MB)',
    recovery: {
      ja: 'ファイルサイズを小さくしてください',
      en: 'Please reduce the file size'
    }
  },

  // ファイル処理エラー
  [ErrorCodes.FILE_UPLOAD_FAILED]: {
    ja: 'ファイルのアップロードに失敗しました',
    en: 'File upload failed',
    recovery: {
      ja: '再度アップロードをお試しください',
      en: 'Please try uploading again'
    }
  },
  [ErrorCodes.FILE_NOT_FOUND]: {
    ja: 'ファイルが見つかりません',
    en: 'File not found',
  },
  [ErrorCodes.FILE_PROCESSING_FAILED]: {
    ja: 'ファイルの処理に失敗しました',
    en: 'File processing failed',
    recovery: {
      ja: 'ファイルが破損していないか確認してください',
      en: 'Please check if the file is corrupted'
    }
  },
  [ErrorCodes.FILE_INVALID_FORMAT]: {
    ja: 'ファイル形式が正しくありません',
    en: 'Invalid file format',
    recovery: {
      ja: '有効なPPTXファイルをアップロードしてください',
      en: 'Please upload a valid PPTX file'
    }
  },
  [ErrorCodes.FILE_CORRUPTED]: {
    ja: 'ファイルが破損している可能性があります',
    en: 'File may be corrupted',
    recovery: {
      ja: 'ファイルを再度保存してからアップロードしてください',
      en: 'Please save the file again and upload'
    }
  },
  [ErrorCodes.FILE_TOO_MANY_SLIDES]: {
    ja: 'スライド数が多すぎます（最大100枚）',
    en: 'Too many slides (max 100)',
    recovery: {
      ja: 'スライド数を減らしてください',
      en: 'Please reduce the number of slides'
    }
  },
  [ErrorCodes.FILE_EMPTY]: {
    ja: 'ファイルが空です',
    en: 'File is empty',
  },
  [ErrorCodes.FILE_PERMISSION_DENIED]: {
    ja: 'このファイルへのアクセス権限がありません',
    en: 'You do not have permission to access this file',
  },
  [ErrorCodes.FILE_DELETE_FAILED]: {
    ja: 'ファイルの削除に失敗しました',
    en: 'Failed to delete file',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait a moment and try again'
    }
  },
  [ErrorCodes.FILE_LIST_FAILED]: {
    ja: 'ファイルリストの取得に失敗しました',
    en: 'Failed to retrieve file list',
    recovery: {
      ja: 'ページを再読み込みしてください',
      en: 'Please reload the page'
    }
  },

  // 翻訳エラー
  [ErrorCodes.TRANSLATION_FAILED]: {
    ja: '翻訳処理に失敗しました',
    en: 'Translation failed',
    recovery: {
      ja: '再度翻訳をお試しください',
      en: 'Please try translating again'
    }
  },
  [ErrorCodes.TRANSLATION_TIMEOUT]: {
    ja: '翻訳処理がタイムアウトしました',
    en: 'Translation timed out',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE]: {
    ja: 'サポートされていない言語です',
    en: 'Unsupported language',
    recovery: {
      ja: 'サポートされている言語を選択してください',
      en: 'Please select a supported language'
    }
  },
  [ErrorCodes.TRANSLATION_EMPTY_TEXT]: {
    ja: '翻訳するテキストが空です',
    en: 'No text to translate',
  },
  [ErrorCodes.TRANSLATION_API_ERROR]: {
    ja: '翻訳APIでエラーが発生しました',
    en: 'Translation API error occurred',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]: {
    ja: '翻訳の利用制限に達しました',
    en: 'Translation quota exceeded',
    recovery: {
      ja: 'プランをアップグレードするか、翌月まで待ってください',
      en: 'Please upgrade your plan or wait until next month'
    }
  },
  [ErrorCodes.TRANSLATION_RATE_LIMITED]: {
    ja: '翻訳リクエストが多すぎます',
    en: 'Too many translation requests',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },

  // データベースエラー
  [ErrorCodes.DATABASE_CONNECTION_FAILED]: {
    ja: 'データベース接続に失敗しました',
    en: 'Database connection failed',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.DATABASE_QUERY_FAILED]: {
    ja: 'データの取得に失敗しました',
    en: 'Failed to retrieve data',
    recovery: {
      ja: 'ページを更新してください',
      en: 'Please refresh the page'
    }
  },
  [ErrorCodes.DATABASE_TRANSACTION_FAILED]: {
    ja: 'データの保存に失敗しました',
    en: 'Failed to save data',
    recovery: {
      ja: '再度お試しください',
      en: 'Please try again'
    }
  },
  [ErrorCodes.DATABASE_CONSTRAINT_VIOLATION]: {
    ja: 'データの整合性エラーが発生しました',
    en: 'Data integrity error occurred',
  },
  [ErrorCodes.DATABASE_DEADLOCK]: {
    ja: 'データベースでデッドロックが発生しました',
    en: 'Database deadlock occurred',
    recovery: {
      ja: '再度お試しください',
      en: 'Please try again'
    }
  },
  [ErrorCodes.DATABASE_TIMEOUT]: {
    ja: 'データベース処理がタイムアウトしました',
    en: 'Database operation timed out',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },

  // 外部サービスエラー
  [ErrorCodes.EXTERNAL_API_ERROR]: {
    ja: '外部サービスでエラーが発生しました',
    en: 'External service error occurred',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.EXTERNAL_API_TIMEOUT]: {
    ja: '外部サービスの応答がタイムアウトしました',
    en: 'External service timed out',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.EXTERNAL_API_RATE_LIMITED]: {
    ja: '外部サービスのレート制限に達しました',
    en: 'External service rate limit reached',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.EXTERNAL_API_UNAUTHORIZED]: {
    ja: '外部サービスの認証に失敗しました',
    en: 'External service authentication failed',
  },
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: {
    ja: '外部サービスが利用できません',
    en: 'External service unavailable',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },

  // ネットワークエラー
  [ErrorCodes.NETWORK_ERROR]: {
    ja: 'ネットワークエラーが発生しました',
    en: 'Network error occurred',
    recovery: {
      ja: 'インターネット接続を確認してください',
      en: 'Please check your internet connection'
    }
  },
  [ErrorCodes.NETWORK_TIMEOUT]: {
    ja: 'ネットワーク接続がタイムアウトしました',
    en: 'Network connection timed out',
    recovery: {
      ja: '接続を確認して再度お試しください',
      en: 'Please check your connection and try again'
    }
  },
  [ErrorCodes.NETWORK_CONNECTION_LOST]: {
    ja: 'ネットワーク接続が失われました',
    en: 'Network connection lost',
    recovery: {
      ja: '接続が回復したら再度お試しください',
      en: 'Please try again when connection is restored'
    }
  },
  [ErrorCodes.NETWORK_DNS_FAILED]: {
    ja: 'DNSの解決に失敗しました',
    en: 'DNS resolution failed',
    recovery: {
      ja: 'ネットワーク設定を確認してください',
      en: 'Please check your network settings'
    }
  },

  // レート制限エラー
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: {
    ja: 'リクエスト数が制限を超えました',
    en: 'Request limit exceeded',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.DAILY_QUOTA_EXCEEDED]: {
    ja: '1日の利用制限に達しました',
    en: 'Daily quota exceeded',
    recovery: {
      ja: '明日以降に再度お試しください',
      en: 'Please try again tomorrow'
    }
  },
  [ErrorCodes.MONTHLY_QUOTA_EXCEEDED]: {
    ja: '月間の利用制限に達しました',
    en: 'Monthly quota exceeded',
    recovery: {
      ja: 'プランをアップグレードするか、翌月まで待ってください',
      en: 'Please upgrade your plan or wait until next month'
    }
  },
  [ErrorCodes.CONCURRENT_REQUEST_LIMIT]: {
    ja: '同時リクエスト数が制限を超えました',
    en: 'Concurrent request limit exceeded',
    recovery: {
      ja: '他の処理が完了してから再度お試しください',
      en: 'Please wait for other processes to complete'
    }
  },

  // システムエラー
  [ErrorCodes.INTERNAL_SERVER_ERROR]: {
    ja: 'サーバーエラーが発生しました',
    en: 'Internal server error occurred',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    ja: 'サービスが一時的に利用できません',
    en: 'Service temporarily unavailable',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.CONFIGURATION_ERROR]: {
    ja: 'システム設定エラーが発生しました',
    en: 'System configuration error',
    recovery: {
      ja: 'サポートにお問い合わせください',
      en: 'Please contact support'
    }
  },
  [ErrorCodes.UNKNOWN_ERROR]: {
    ja: '予期しないエラーが発生しました',
    en: 'An unexpected error occurred',
    recovery: {
      ja: 'ページを更新して再度お試しください',
      en: 'Please refresh the page and try again'
    }
  },

  // セキュリティエラー
  [ErrorCodes.SECURITY_FILE_VALIDATION_FAILED]: {
    ja: 'ファイルのセキュリティ検証に失敗しました',
    en: 'File security validation failed',
    recovery: {
      ja: 'ファイルが安全であることを確認してください',
      en: 'Please ensure your file is safe'
    }
  },
  [ErrorCodes.SECURITY_CSRF_TOKEN_INVALID]: {
    ja: 'CSRFトークンが無効です',
    en: 'Invalid CSRF token',
    recovery: {
      ja: 'ページを再読み込みしてください',
      en: 'Please reload the page'
    }
  },
  [ErrorCodes.SECURITY_RATE_LIMIT_EXCEEDED]: {
    ja: 'レート制限を超えました',
    en: 'Rate limit exceeded',
    recovery: {
      ja: 'しばらく待ってから再度お試しください',
      en: 'Please wait and try again'
    }
  },
  [ErrorCodes.SECURITY_XSS_DETECTED]: {
    ja: 'XSS攻撃が検出されました',
    en: 'XSS attack detected',
    recovery: {
      ja: '入力内容を確認してください',
      en: 'Please check your input'
    }
  },
  [ErrorCodes.SECURITY_SQL_INJECTION_DETECTED]: {
    ja: 'SQLインジェクションが検出されました',
    en: 'SQL injection detected',
    recovery: {
      ja: '入力内容を確認してください',
      en: 'Please check your input'
    }
  },
};

/**
 * 言語設定に基づいてエラーメッセージを取得
 */
export function getErrorMessage(
  code: ErrorCode,
  language: 'ja' | 'en' = 'ja',
  includeRecovery: boolean = true
): string {
  const message = ErrorMessages[code];
  
  if (!message) {
    return language === 'ja' 
      ? '予期しないエラーが発生しました'
      : 'An unexpected error occurred';
  }

  let result = message[language];
  
  if (includeRecovery && message.recovery) {
    result += `\n${message.recovery[language]}`;
  }
  
  return result;
}

/**
 * エラーメッセージオブジェクトを取得（コンポーネント用）
 */
export function getErrorMessageObject(
  code: string | ErrorCode
): ErrorMessage | undefined {
  // 文字列の場合はErrorCodeかチェック
  if (code in ErrorMessages) {
    return ErrorMessages[code as ErrorCode];
  }
  return undefined;
}

/**
 * エラーコードから復旧方法のみを取得
 */
export function getRecoveryMessage(
  code: ErrorCode,
  language: 'ja' | 'en' = 'ja'
): string | undefined {
  const message = ErrorMessages[code];
  return message?.recovery?.[language];
}

/**
 * デフォルトのエラーメッセージ
 */
export const DEFAULT_ERROR_MESSAGE = {
  ja: 'エラーが発生しました。しばらく待ってから再度お試しください。',
  en: 'An error occurred. Please wait and try again.',
};
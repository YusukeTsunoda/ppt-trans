/**
 * 統一エラーメッセージシステム
 * アプリケーション全体で一貫したエラーメッセージを提供
 */

export enum ErrorCode {
  // ファイル関連
  FILE_NOT_SELECTED = 'FILE_NOT_SELECTED',
  FILE_TYPE_INVALID = 'FILE_TYPE_INVALID',
  FILE_SIZE_TOO_LARGE = 'FILE_SIZE_TOO_LARGE',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  FILE_DOWNLOAD_FAILED = 'FILE_DOWNLOAD_FAILED',
  FILE_PROCESSING_FAILED = 'FILE_PROCESSING_FAILED',
  
  // 翻訳関連
  TRANSLATION_FAILED = 'TRANSLATION_FAILED',
  TRANSLATION_API_KEY_MISSING = 'TRANSLATION_API_KEY_MISSING',
  TRANSLATION_RATE_LIMIT = 'TRANSLATION_RATE_LIMIT',
  TRANSLATION_INVALID_LANGUAGE = 'TRANSLATION_INVALID_LANGUAGE',
  TRANSLATION_TEXT_TOO_LONG = 'TRANSLATION_TEXT_TOO_LONG',
  
  // ネットワーク関連
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  
  // 認証関連
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  
  // Supabase関連
  SUPABASE_CONNECTION_FAILED = 'SUPABASE_CONNECTION_FAILED',
  SUPABASE_BUCKET_ERROR = 'SUPABASE_BUCKET_ERROR',
  SUPABASE_UPLOAD_FAILED = 'SUPABASE_UPLOAD_FAILED',
  
  // 一般的なエラー
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
}

interface ErrorMessage {
  code: ErrorCode;
  message: string;
  userMessage: string; // ユーザーに表示するメッセージ
  technicalDetails?: string; // 技術的な詳細（開発者向け）
  actions?: string[]; // 推奨されるアクション
}

/**
 * エラーメッセージの定義
 */
const errorMessages: Record<ErrorCode, Omit<ErrorMessage, 'code'>> = {
  // ファイル関連
  [ErrorCode.FILE_NOT_SELECTED]: {
    message: 'No file selected',
    userMessage: 'ファイルが選択されていません。',
    actions: ['PPTXファイルを選択してください']
  },
  
  [ErrorCode.FILE_TYPE_INVALID]: {
    message: 'Invalid file type',
    userMessage: 'サポートされていないファイル形式です。',
    actions: ['PPTXファイルのみアップロード可能です']
  },
  
  [ErrorCode.FILE_SIZE_TOO_LARGE]: {
    message: 'File size exceeds limit',
    userMessage: 'ファイルサイズが大きすぎます。',
    actions: ['50MB以下のファイルを選択してください']
  },
  
  [ErrorCode.FILE_UPLOAD_FAILED]: {
    message: 'File upload failed',
    userMessage: 'ファイルのアップロードに失敗しました。',
    actions: ['ネットワーク接続を確認してください', '再度お試しください']
  },
  
  [ErrorCode.FILE_DOWNLOAD_FAILED]: {
    message: 'File download failed',
    userMessage: 'ファイルのダウンロードに失敗しました。',
    actions: ['ダウンロードリンクを確認してください', 'ブラウザの設定を確認してください']
  },
  
  [ErrorCode.FILE_PROCESSING_FAILED]: {
    message: 'File processing failed',
    userMessage: 'ファイルの処理中にエラーが発生しました。',
    actions: ['ファイルが破損していないか確認してください', '別のファイルをお試しください']
  },
  
  // 翻訳関連
  [ErrorCode.TRANSLATION_FAILED]: {
    message: 'Translation failed',
    userMessage: '翻訳処理に失敗しました。',
    actions: ['再度お試しください', 'テキスト量を減らしてください']
  },
  
  [ErrorCode.TRANSLATION_API_KEY_MISSING]: {
    message: 'API key is missing',
    userMessage: 'APIキーが設定されていません。',
    technicalDetails: 'ANTHROPIC_API_KEY environment variable is not set',
    actions: ['管理者に連絡してください']
  },
  
  [ErrorCode.TRANSLATION_RATE_LIMIT]: {
    message: 'Rate limit exceeded',
    userMessage: 'APIのレート制限に達しました。',
    actions: ['しばらく待ってから再度お試しください', '小さいバッチで処理してください']
  },
  
  [ErrorCode.TRANSLATION_INVALID_LANGUAGE]: {
    message: 'Invalid target language',
    userMessage: 'サポートされていない言語です。',
    actions: ['サポートされている言語を選択してください']
  },
  
  [ErrorCode.TRANSLATION_TEXT_TOO_LONG]: {
    message: 'Text exceeds maximum length',
    userMessage: 'テキストが長すぎます。',
    actions: ['テキストを分割してください', '100,000文字以下にしてください']
  },
  
  // ネットワーク関連
  [ErrorCode.NETWORK_ERROR]: {
    message: 'Network error occurred',
    userMessage: 'ネットワークエラーが発生しました。',
    actions: ['インターネット接続を確認してください', 'VPNを無効にしてみてください']
  },
  
  [ErrorCode.TIMEOUT_ERROR]: {
    message: 'Request timeout',
    userMessage: 'リクエストがタイムアウトしました。',
    actions: ['処理に時間がかかっています', 'しばらくお待ちください']
  },
  
  [ErrorCode.SERVER_ERROR]: {
    message: 'Internal server error',
    userMessage: 'サーバーエラーが発生しました。',
    actions: ['しばらく待ってから再度お試しください', '問題が続く場合は管理者に連絡してください']
  },
  
  // 認証関連
  [ErrorCode.AUTH_FAILED]: {
    message: 'Authentication failed',
    userMessage: '認証に失敗しました。',
    actions: ['ログイン情報を確認してください', '再度ログインしてください']
  },
  
  [ErrorCode.AUTH_TOKEN_EXPIRED]: {
    message: 'Authentication token expired',
    userMessage: 'セッションの有効期限が切れました。',
    actions: ['再度ログインしてください']
  },
  
  [ErrorCode.AUTH_PERMISSION_DENIED]: {
    message: 'Permission denied',
    userMessage: 'アクセス権限がありません。',
    actions: ['管理者に権限を申請してください']
  },
  
  // Supabase関連
  [ErrorCode.SUPABASE_CONNECTION_FAILED]: {
    message: 'Supabase connection failed',
    userMessage: 'ストレージサービスへの接続に失敗しました。',
    technicalDetails: 'Failed to connect to Supabase',
    actions: ['ネットワーク接続を確認してください']
  },
  
  [ErrorCode.SUPABASE_BUCKET_ERROR]: {
    message: 'Storage bucket error',
    userMessage: 'ストレージの準備に失敗しました。',
    actions: ['管理者に連絡してください']
  },
  
  [ErrorCode.SUPABASE_UPLOAD_FAILED]: {
    message: 'Upload to storage failed',
    userMessage: 'ファイルの保存に失敗しました。',
    actions: ['ファイルサイズを確認してください', '再度お試しください']
  },
  
  // 一般的なエラー
  [ErrorCode.UNKNOWN_ERROR]: {
    message: 'An unknown error occurred',
    userMessage: '予期しないエラーが発生しました。',
    actions: ['ページを更新してください', '問題が続く場合は管理者に連絡してください']
  },
  
  [ErrorCode.INVALID_INPUT]: {
    message: 'Invalid input provided',
    userMessage: '入力内容に誤りがあります。',
    actions: ['入力内容を確認してください']
  },
  
  [ErrorCode.OPERATION_CANCELLED]: {
    message: 'Operation was cancelled',
    userMessage: '操作がキャンセルされました。',
    actions: []
  }
};

/**
 * エラーコードからエラーメッセージを取得
 */
export function getErrorMessage(code: ErrorCode): ErrorMessage {
  const message = errorMessages[code] || errorMessages[ErrorCode.UNKNOWN_ERROR];
  return {
    code,
    ...message
  };
}

/**
 * エラーオブジェクトからエラーコードを推定
 */
export function inferErrorCode(error: any): ErrorCode {
  if (!error) return ErrorCode.UNKNOWN_ERROR;
  
  const message = error.message?.toLowerCase() || '';
  const statusCode = error.status || error.statusCode;
  
  // ステータスコードベースの判定
  if (statusCode === 401) return ErrorCode.AUTH_FAILED;
  if (statusCode === 403) return ErrorCode.AUTH_PERMISSION_DENIED;
  if (statusCode === 429) return ErrorCode.TRANSLATION_RATE_LIMIT;
  if (statusCode === 500) return ErrorCode.SERVER_ERROR;
  if (statusCode === 504) return ErrorCode.TIMEOUT_ERROR;
  
  // メッセージベースの判定
  if (message.includes('network')) return ErrorCode.NETWORK_ERROR;
  if (message.includes('timeout')) return ErrorCode.TIMEOUT_ERROR;
  if (message.includes('api key')) return ErrorCode.TRANSLATION_API_KEY_MISSING;
  if (message.includes('rate limit')) return ErrorCode.TRANSLATION_RATE_LIMIT;
  if (message.includes('file') && message.includes('upload')) return ErrorCode.FILE_UPLOAD_FAILED;
  if (message.includes('file') && message.includes('download')) return ErrorCode.FILE_DOWNLOAD_FAILED;
  if (message.includes('supabase')) return ErrorCode.SUPABASE_CONNECTION_FAILED;
  if (message.includes('translation')) return ErrorCode.TRANSLATION_FAILED;
  
  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * エラーハンドリングヘルパー
 */
export class ErrorHandler {
  /**
   * エラーを処理してユーザーフレンドリーなメッセージを返す
   */
  static handle(error: any): {
    userMessage: string;
    technicalMessage: string;
    actions: string[];
    code: ErrorCode;
  } {
    const errorCode = inferErrorCode(error);
    const errorMessage = getErrorMessage(errorCode);
    
    return {
      userMessage: errorMessage.userMessage,
      technicalMessage: error.message || errorMessage.message,
      actions: errorMessage.actions || [],
      code: errorCode
    };
  }
  
  /**
   * エラーをログに記録
   */
  static log(error: any, context?: string): void {
    const handled = this.handle(error);
    
    console.error('Error occurred:', {
      context,
      code: handled.code,
      userMessage: handled.userMessage,
      technicalMessage: handled.technicalMessage,
      originalError: error,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * エラーを表示用にフォーマット
   */
  static format(error: any): string {
    const handled = this.handle(error);
    let message = handled.userMessage;
    
    if (handled.actions.length > 0) {
      message += '\n\n推奨アクション:\n';
      message += handled.actions.map(action => `• ${action}`).join('\n');
    }
    
    return message;
  }
}
/**
 * エラーメッセージの日本語定義
 */

import { ErrorCode, ErrorCodes } from './ErrorCodes';

/**
 * エラーコードに対応する日本語メッセージ
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  // 認証・認可エラー
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: 'メールアドレスまたはパスワードが正しくありません',
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: '認証トークンの有効期限が切れています。再度ログインしてください',
  [ErrorCodes.AUTH_TOKEN_INVALID]: '認証トークンが無効です。再度ログインしてください',
  [ErrorCodes.AUTH_UNAUTHORIZED]: 'この操作を実行する権限がありません',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: 'セッションの有効期限が切れました。再度ログインしてください',
  [ErrorCodes.AUTH_USER_NOT_FOUND]: 'ユーザーが見つかりません',
  [ErrorCodes.AUTH_ACCOUNT_LOCKED]: 'アカウントがロックされています。サポートにお問い合わせください',
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: 'メールアドレスが確認されていません。確認メールをご確認ください',
  
  // バリデーションエラー
  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: '必須項目が入力されていません',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: '入力形式が正しくありません',
  [ErrorCodes.VALIDATION_INVALID_EMAIL]: 'メールアドレスの形式が正しくありません',
  [ErrorCodes.VALIDATION_INVALID_PASSWORD]: 'パスワードは8文字以上で、英数字を含む必要があります',
  [ErrorCodes.VALIDATION_FIELD_TOO_LONG]: '入力内容が長すぎます',
  [ErrorCodes.VALIDATION_FIELD_TOO_SHORT]: '入力内容が短すぎます',
  [ErrorCodes.VALIDATION_INVALID_FILE_TYPE]: 'ファイル形式が正しくありません。PPTX形式のファイルを選択してください',
  [ErrorCodes.VALIDATION_FILE_TOO_LARGE]: 'ファイルサイズが大きすぎます。100MB以下のファイルを選択してください',
  
  // ファイル処理エラー
  [ErrorCodes.FILE_UPLOAD_FAILED]: 'ファイルのアップロードに失敗しました。再度お試しください',
  [ErrorCodes.FILE_NOT_FOUND]: 'ファイルが見つかりません',
  [ErrorCodes.FILE_PROCESSING_FAILED]: 'ファイルの処理に失敗しました。ファイルが破損している可能性があります',
  [ErrorCodes.FILE_INVALID_FORMAT]: 'ファイル形式が不正です。PowerPoint（.pptx）ファイルを選択してください',
  [ErrorCodes.FILE_CORRUPTED]: 'ファイルが破損しています。別のファイルをお試しください',
  [ErrorCodes.FILE_TOO_MANY_SLIDES]: 'スライド数が多すぎます。100枚以下のプレゼンテーションを選択してください',
  [ErrorCodes.FILE_EMPTY]: 'ファイルが空です。内容のあるファイルを選択してください',
  [ErrorCodes.FILE_PERMISSION_DENIED]: 'このファイルへのアクセス権限がありません',
  [ErrorCodes.FILE_DELETE_FAILED]: 'ファイルの削除に失敗しました',
  [ErrorCodes.FILE_LIST_FAILED]: 'ファイル一覧の取得に失敗しました',
  
  // 翻訳エラー
  [ErrorCodes.TRANSLATION_FAILED]: '翻訳に失敗しました。再度お試しください',
  [ErrorCodes.TRANSLATION_TIMEOUT]: '翻訳処理がタイムアウトしました。テキスト量を減らしてお試しください',
  [ErrorCodes.TRANSLATION_UNSUPPORTED_LANGUAGE]: '指定された言語はサポートされていません',
  [ErrorCodes.TRANSLATION_EMPTY_TEXT]: '翻訳するテキストを入力してください',
  [ErrorCodes.TRANSLATION_API_ERROR]: '翻訳APIでエラーが発生しました。しばらくしてから再度お試しください',
  [ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]: '翻訳の利用制限に達しました。プランをアップグレードしてください',
  [ErrorCodes.TRANSLATION_RATE_LIMITED]: '翻訳リクエストが多すぎます。しばらく待ってから再度お試しください',
  
  // データベースエラー
  [ErrorCodes.DATABASE_CONNECTION_FAILED]: 'データベースに接続できません。システム管理者にお問い合わせください',
  [ErrorCodes.DATABASE_QUERY_FAILED]: 'データの取得に失敗しました。再度お試しください',
  [ErrorCodes.DATABASE_TRANSACTION_FAILED]: 'データベース処理に失敗しました。再度お試しください',
  [ErrorCodes.DATABASE_CONSTRAINT_VIOLATION]: 'データの整合性エラーが発生しました',
  [ErrorCodes.DATABASE_DEADLOCK]: 'データベースで競合が発生しました。再度お試しください',
  [ErrorCodes.DATABASE_TIMEOUT]: 'データベース処理がタイムアウトしました',
  
  // 外部サービスエラー
  [ErrorCodes.EXTERNAL_API_ERROR]: '外部サービスでエラーが発生しました',
  [ErrorCodes.EXTERNAL_API_TIMEOUT]: '外部サービスへの接続がタイムアウトしました',
  [ErrorCodes.EXTERNAL_API_RATE_LIMITED]: '外部サービスのレート制限に達しました',
  [ErrorCodes.EXTERNAL_API_UNAUTHORIZED]: '外部サービスへの認証に失敗しました',
  [ErrorCodes.EXTERNAL_SERVICE_UNAVAILABLE]: '外部サービスが一時的に利用できません',
  
  // ネットワークエラー
  [ErrorCodes.NETWORK_ERROR]: 'ネットワークエラーが発生しました。インターネット接続を確認してください',
  [ErrorCodes.NETWORK_TIMEOUT]: 'ネットワーク接続がタイムアウトしました',
  [ErrorCodes.NETWORK_CONNECTION_LOST]: 'ネットワーク接続が失われました',
  [ErrorCodes.NETWORK_DNS_FAILED]: 'DNS解決に失敗しました',
  
  // レート制限エラー
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'リクエストが多すぎます。しばらくしてから再度お試しください',
  [ErrorCodes.DAILY_QUOTA_EXCEEDED]: '本日の利用制限に達しました',
  [ErrorCodes.MONTHLY_QUOTA_EXCEEDED]: '今月の利用制限に達しました。プランをアップグレードしてください',
  [ErrorCodes.CONCURRENT_REQUEST_LIMIT]: '同時リクエスト数の上限に達しました',
  
  // セキュリティエラー
  [ErrorCodes.SECURITY_FILE_VALIDATION_FAILED]: 'ファイルのセキュリティチェックに失敗しました',
  [ErrorCodes.SECURITY_CSRF_TOKEN_INVALID]: 'セキュリティトークンが無効です。ページを更新してください',
  [ErrorCodes.SECURITY_RATE_LIMIT_EXCEEDED]: 'セキュリティ制限に達しました。しばらくお待ちください',
  [ErrorCodes.SECURITY_XSS_DETECTED]: '不正な入力が検出されました',
  [ErrorCodes.SECURITY_SQL_INJECTION_DETECTED]: '不正な入力が検出されました',
  
  // システムエラー
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 'サーバー内部エラーが発生しました。しばらくしてから再度お試しください',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'サービスが一時的に利用できません。メンテナンス中の可能性があります',
  [ErrorCodes.CONFIGURATION_ERROR]: 'システム設定に問題があります。管理者にお問い合わせください',
  [ErrorCodes.UNKNOWN_ERROR]: '予期しないエラーが発生しました。サポートにお問い合わせください',
};

/**
 * エラーコードから適切なユーザーメッセージを取得
 */
export function getErrorMessage(code: ErrorCode, customMessage?: string): string {
  return customMessage || ErrorMessages[code] || ErrorMessages[ErrorCodes.UNKNOWN_ERROR];
}

/**
 * エラーの詳細説明を取得
 */
export const ErrorDescriptions: Partial<Record<ErrorCode, string>> = {
  [ErrorCodes.FILE_TOO_MANY_SLIDES]: 'プレゼンテーションのスライド数が多すぎます。処理可能なスライド数は100枚までです。スライドを分割してから再度お試しください。',
  [ErrorCodes.TRANSLATION_QUOTA_EXCEEDED]: '今月の翻訳可能文字数の上限に達しました。有料プランへのアップグレードをご検討ください。',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: '短時間に多くのリクエストが送信されました。セキュリティ保護のため、しばらくお待ちいただいてから再度お試しください。',
  [ErrorCodes.FILE_CORRUPTED]: 'アップロードされたファイルが破損しているか、正しいPowerPoint形式ではありません。ファイルを修復するか、別のファイルをお試しください。',
};

/**
 * エラーの解決方法を取得
 */
export const ErrorSolutions: Partial<Record<ErrorCode, string[]>> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: [
    'メールアドレスとパスワードを確認してください',
    'パスワードを忘れた場合は「パスワードを忘れた方」からリセットできます',
    'アカウントをお持ちでない場合は新規登録してください',
  ],
  [ErrorCodes.VALIDATION_FILE_TOO_LARGE]: [
    'ファイルサイズを100MB以下に圧縮してください',
    '画像を圧縮するか、不要なスライドを削除してください',
    '複数のファイルに分割してアップロードしてください',
  ],
  [ErrorCodes.NETWORK_ERROR]: [
    'インターネット接続を確認してください',
    'ファイアウォールやプロキシの設定を確認してください',
    'ブラウザを更新してから再度お試しください',
  ],
  [ErrorCodes.TRANSLATION_TIMEOUT]: [
    'テキスト量を減らしてください',
    'スライドを分割して処理してください',
    '複雑な表やグラフを簡略化してください',
  ],
};

/**
 * エラーメッセージをフォーマット
 */
export function formatErrorMessage(
  code: ErrorCode,
  options?: {
    includeCode?: boolean;
    includeDescription?: boolean;
    includeSolutions?: boolean;
  }
): {
  message: string;
  code?: string;
  description?: string;
  solutions?: string[];
} {
  const result: any = {
    message: getErrorMessage(code),
  };

  if (options?.includeCode) {
    result.code = code;
  }

  if (options?.includeDescription && ErrorDescriptions[code]) {
    result.description = ErrorDescriptions[code];
  }

  if (options?.includeSolutions && ErrorSolutions[code]) {
    result.solutions = ErrorSolutions[code];
  }

  return result;
}

/**
 * エラーメッセージオブジェクトを取得（後方互換性のため）
 */
export function getErrorMessageObject(code: ErrorCode): {
  message: string;
  description?: string;
  solution?: string;
} {
  const message = getErrorMessage(code);
  const description = ErrorDescriptions[code];
  const solution = ErrorSolutions[code]?.[0]; // 最初の解決策を使用
  
  return {
    message,
    description,
    solution,
  };
}

/**
 * リカバリーメッセージを取得
 */
export function getRecoveryMessage(code: ErrorCode): string {
  const solutions = ErrorSolutions[code];
  return solutions?.[0] || '問題が解決しない場合は、サポートにお問い合わせください。';
}
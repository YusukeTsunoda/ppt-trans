/**
 * Server Actions共通の型定義
 */

// 基本的なアクション結果の型
export interface ActionResult<T = void> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
}

// エラーレスポンスの生成
export function createErrorResponse(error: unknown, defaultMessage: string): ActionResult {
  console.error('Action error:', error);
  
  if (error instanceof Error) {
    // Supabase Auth エラーの特別処理
    if ('status' in error && error.status === 400) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'メールアドレスまたはパスワードが正しくありません' };
      }
      if (error.message.includes('already registered')) {
        return { error: 'このメールアドレスは既に登録されています' };
      }
    }
    
    // その他のエラー
    return { error: error.message || defaultMessage };
  }
  
  return { error: defaultMessage };
}

// 成功レスポンスの生成
export function createSuccessResponse<T = void>(
  message: string, 
  data?: T
): ActionResult<T> {
  return {
    success: true,
    message,
    data
  };
}

// バリデーションエラーの生成
export function createValidationError(message: string): ActionResult {
  return { error: message };
}
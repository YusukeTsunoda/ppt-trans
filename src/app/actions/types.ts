/**
 * Server Actions共通の型定義
 */

import logger from '@/lib/logger';

// 基本的なアクション結果の型（統一版）
export interface ActionResult<T = void> {
  success: boolean;    // 必須: 成功/失敗を明確に
  message: string;      // 必須: すべてのメッセージを統一
  data?: T;
  code?: string;        // オプション: エラーコード
}

// エラーレスポンスの生成（統一版）
export function createErrorResponse(error: unknown, defaultMessage: string): ActionResult {
  logger.error('Action error:', error);
  
  if (error instanceof Error) {
    // Supabase Auth エラーの特別処理
    if ('status' in error && error.status === 400) {
      if (error.message.includes('Invalid login credentials')) {
        return { 
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません',
          code: 'INVALID_CREDENTIALS'
        };
      }
      if (error.message.includes('already registered')) {
        return { 
          success: false,
          message: 'このメールアドレスは既に登録されています',
          code: 'ALREADY_REGISTERED'
        };
      }
    }
    
    // その他のエラー
    return { 
      success: false,
      message: error.message || defaultMessage,
      code: 'UNKNOWN_ERROR'
    };
  }
  
  return { 
    success: false,
    message: defaultMessage,
    code: 'UNKNOWN_ERROR'
  };
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

// バリデーションエラーの生成（統一版）
export function createValidationError(message: string): ActionResult {
  return { 
    success: false,
    message: message,
    code: 'VALIDATION_ERROR'
  };
}
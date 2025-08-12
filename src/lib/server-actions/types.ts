/**
 * Server Action Types
 * 
 * シンプルな型定義 for Next.js 15 Server Actions with useActionState
 */

/**
 * Server Action標準レスポンス型
 * useActionStateと互換性のある構造
 */
export interface ServerActionState<T = any> {
  success: boolean;
  data?: T;
  message: string;
  timestamp?: number; // Optional to avoid hydration issues
}

/**
 * 初期状態のヘルパー関数
 */
export function createInitialState<T = any>(): ServerActionState<T> {
  return {
    success: false,
    message: '',
    // timestamp removed to avoid hydration issues
  };
}

/**
 * 成功状態のヘルパー関数
 */
export function createSuccessState<T>(
  data: T,
  message: string = '処理が完了しました'
): ServerActionState<T> {
  return {
    success: true,
    data,
    message,
    // timestamp removed to avoid hydration issues
  };
}

/**
 * エラー状態のヘルパー関数
 */
export function createErrorState<T = any>(
  message: string,
  _code?: string
): ServerActionState<T> {
  return {
    success: false,
    message,
    // timestamp removed to avoid hydration issues
  };
}
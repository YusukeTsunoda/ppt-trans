/**
 * テストモード検出とバイパス機能
 * 環境変数に基づいてテスト時の動作を制御
 */

import logger from '@/lib/logger';

/**
 * テストモードかどうかを判定
 */
export function isTestMode(): boolean {
  return process.env.NEXT_PUBLIC_TEST_MODE === 'true' ||
         process.env.NODE_ENV === 'test';
}

/**
 * 認証バイパスが有効かどうか
 */
export function isAuthBypassEnabled(): boolean {
  return process.env.TEST_BYPASS_AUTH === 'true' && isTestMode();
}

/**
 * MSWモックが有効かどうか
 */
export function isMSWEnabled(): boolean {
  return process.env.USE_MSW_MOCKS === 'true' && isTestMode();
}

/**
 * テストユーザーの認証情報を取得
 * 本番環境では絶対に使用不可
 */
export function getTestCredentials() {
  // 本番環境では必ずnullを返す
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  
  if (!isTestMode()) {
    return null;
  }
  
  // テスト環境でのみ、環境変数から取得（デフォルト値は設定しない）
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  
  if (!email || !password) {
    logger.warn('[TEST] Test credentials not configured in environment variables');
    return null;
  }
  
  return { email, password };
}

/**
 * テスト用のデバッグログ
 */
export function testLog(message: string, ...args: any[]) {
  if (isTestMode() && process.env.LOG_LEVEL === 'debug') {
    logger.info(`[TEST] ${message}`, { args });
  }
}

/**
 * テストモードでのタイムアウト値を取得
 */
export function getTestTimeout(defaultTimeout: number = 5000): number {
  if (isTestMode()) {
    const testTimeout = process.env.TEST_TIMEOUT;
    return testTimeout ? parseInt(testTimeout, 10) : defaultTimeout * 2;
  }
  return defaultTimeout;
}

/**
 * テストモードでのナビゲーションタイムアウト
 */
export function getNavigationTimeout(): number {
  if (isTestMode()) {
    const navTimeout = process.env.TEST_NAVIGATION_TIMEOUT;
    return navTimeout ? parseInt(navTimeout, 10) : 15000;
  }
  return 10000;
}

/**
 * テストモードでのリトライ設定
 */
export function getRetryConfig() {
  if (isTestMode()) {
    return {
      count: parseInt(process.env.TEST_RETRY_COUNT || '2', 10),
      delay: 1000
    };
  }
  return {
    count: 3,
    delay: 2000
  };
}

/**
 * テスト環境用のAPIエンドポイント
 */
export function getApiEndpoint(path: string): string {
  if (isTestMode()) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    return `${baseUrl}${path}`;
  }
  return path;
}

/**
 * テストモード用のエラーハンドリング
 */
export function handleTestError(error: any) {
  if (isTestMode()) {
    // テストモードでは詳細なエラー情報を出力
    logger.error('[TEST ERROR]', error, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // スクリーンショットのトリガー
    if (process.env.SCREENSHOT_ON_FAILURE === 'true') {
      // PlaywrightやE2Eテストツールでキャプチャ
      logger.info('[TEST] スクリーンショットをトリガー');
    }
  }
  
  throw error;
}

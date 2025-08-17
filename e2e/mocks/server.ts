import { setupServer } from 'msw/node';
import { handlers, errorHandlers } from './handlers';

/**
 * MSWサーバーのセットアップ
 * Node.js環境でHTTPリクエストをインターセプト
 */

// デフォルトハンドラーでサーバーを作成
export const server = setupServer(...handlers);

/**
 * サーバーのライフサイクル管理
 */
export const mswServer = {
  /**
   * サーバーを開始
   */
  start: () => {
    server.listen({
      onUnhandledRequest: 'warn', // ハンドルされないリクエストは警告
    });
    console.log('🔧 MSWサーバーが起動しました');
  },

  /**
   * サーバーを停止
   */
  stop: () => {
    server.close();
    console.log('🛑 MSWサーバーが停止しました');
  },

  /**
   * ハンドラーをリセット
   */
  reset: () => {
    server.resetHandlers();
  },

  /**
   * 特定のハンドラーを使用
   */
  use: (...customHandlers: any[]) => {
    server.use(...customHandlers);
  },

  /**
   * エラーシナリオを有効化
   */
  enableErrorScenario: (scenario: keyof typeof errorHandlers) => {
    const handlers = errorHandlers[scenario];
    if (handlers) {
      server.use(...handlers);
      console.log(`⚠️ エラーシナリオ「${scenario}」を有効化しました`);
    }
  },

  /**
   * 認証をモック
   */
  mockAuthentication: (isAuthenticated: boolean = true) => {
    if (isAuthenticated) {
      // 認証成功のモック
      server.use(
        ...handlers.filter(h => h.info.path.includes('auth'))
      );
      console.log('✅ 認証成功をモック化');
    } else {
      // 認証失敗のモック
      server.use(
        ...errorHandlers.serverError.filter(h => h.info.path.includes('auth'))
      );
      console.log('❌ 認証失敗をモック化');
    }
  }
};

/**
 * Playwrightテスト用のセットアップ
 */
export function setupMSWForPlaywright() {
  // テスト開始前
  beforeAll(() => {
    mswServer.start();
  });

  // 各テスト後
  afterEach(() => {
    mswServer.reset();
  });

  // テスト終了後
  afterAll(() => {
    mswServer.stop();
  });
}
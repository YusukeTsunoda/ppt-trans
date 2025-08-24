import { chromium, FullConfig } from '@playwright/test';
import { setupServer } from 'msw/node';
import { authHandlers, serverActionHandlers } from '../mocks/handlers';

// MSWサーバーのグローバルインスタンス
export let mswServer: ReturnType<typeof setupServer>;

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup...');
  
  // 1. MSWサーバーの初期化（実際のSupabaseを使用するため無効化）
  const useMocks = process.env.USE_MSW_MOCKS === 'true';
  
  if (useMocks) {
    console.log('📡 Initializing MSW mock server...');
    mswServer = setupServer(...authHandlers, ...serverActionHandlers);
    mswServer.listen({
      onUnhandledRequest: 'warn'
    });
    console.log('✅ MSW mock server started');
  } else {
    console.log('⚠️ MSW mocks disabled, using real Supabase');
  }

  // 2. 認証状態の初期化
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 実際のSupabaseでログイン
    console.log('🔐 Setting up authentication...');
    await page.goto(`${baseURL}/login`);
    
    // ログインフォーム
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button[type="submit"]:has-text("ログイン")');
    
    // ログイン成功を待つ（リダイレクトまたはダッシュボード表示）
    await page.waitForURL(/\/(dashboard|upload)/, { timeout: 10000 });
    
    // 認証状態を保存
    await context.storageState({ path: 'e2e/.auth/user.json' });
    console.log('✅ Authentication setup complete');
    
  } catch (error) {
    console.error('❌ Authentication setup failed:', error);
    // 認証エラーは無視して続行（個別テストで対処）
  } finally {
    await browser.close();
  }
  
  return async () => {
    // グローバルティアダウン
    if (useMocks && mswServer) {
      console.log('🛑 Stopping MSW mock server...');
      mswServer.close();
    }
  };
}

export default globalSetup;
import { test as setup } from '@playwright/test';
import path from 'path';

/**
 * 認証状態のセットアップ
 * 一度だけ実行され、認証状態を保存する
 */
setup('authenticate', async ({ page, context }) => {
  // 環境変数からテストユーザーの認証情報を取得（統一）
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'Test123!@#';
  
  console.log('🔐 認証セットアップを開始...');
  
  // ログインページへ移動
  await page.goto('/login');
  
  // ログインフォームが表示されるまで待機
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
  
  // 認証情報を入力
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', testPassword);
  
  // ログインボタンをクリック
  const submitButton = page.locator('button[type="submit"]').first();
  await submitButton.click();
  
  // 認証成功を確認（複数の成功条件のいずれか）
  try {
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 15000 }),
      page.waitForURL('**/upload', { timeout: 15000 }),
      page.waitForSelector('text=/ログイン成功|Welcome|ダッシュボード/', { timeout: 15000 })
    ]);
    
    console.log('✅ 認証成功！');
  } catch (error) {
    console.error('❌ 認証に失敗しました:', error);
    
    // スクリーンショットを保存
    await page.screenshot({ 
      path: path.join('test-results', 'auth-setup-failure.png'),
      fullPage: true 
    });
    
    throw new Error('認証セットアップに失敗しました');
  }
  
  // 認証状態を保存（環境変数で場所を指定可能）
  const authFile = process.env.AUTH_STATE_FILE || '.auth/test-auth.json';
  await context.storageState({ path: authFile });
  console.log(`💾 認証状態を ${authFile} に保存しました`);
  
  // Supabaseのセッション情報も保存（必要に応じて）
  const localStorage = await page.evaluate(() => {
    const storage: Record<string, any> = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.includes('supabase')) {
        storage[key] = window.localStorage.getItem(key);
      }
    }
    return storage;
  });
  
  console.log('📦 Supabaseセッション情報を取得しました');
});
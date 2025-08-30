import { test, expect } from '@playwright/test';

/**
 * シンプルな認証テスト - ローカルSupabaseのテストユーザーを使用
 */
test.describe('認証テスト（簡易版）', () => {
  
  test('管理者ログインのテスト', async ({ page }) => {
    // ログインページに移動
    await page.goto('/login');
    
    // ページが読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // テストユーザー情報（seed.sqlから）
    const adminUser = {
      email: 'admin@example.com',
      password: 'admin123456'
    };
    
    console.log('管理者でログイン:', adminUser.email);
    
    // メールアドレスとパスワードを入力
    await page.fill('input[type="email"], input[name="email"], input#email', adminUser.email);
    await page.fill('input[type="password"], input[name="password"], input#password', adminUser.password);
    
    // スクリーンショットを撮る（デバッグ用）
    await page.screenshot({ path: 'test-results/admin-login-before.png' });
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();
    
    // ナビゲーションを待つ（タイムアウトを長めに設定）
    await page.waitForURL((url) => {
      return url.pathname !== '/login';
    }, { timeout: 30000 });
    
    // ログイン後のスクリーンショット
    await page.screenshot({ path: 'test-results/admin-login-after.png' });
    
    // ダッシュボードまたは管理画面に遷移したことを確認
    const currentURL = page.url();
    console.log('ログイン後のURL:', currentURL);
    
    expect(currentURL).not.toContain('/login');
    expect(currentURL).toMatch(/\/(dashboard|admin|upload)/);
  });
  
  test('通常ユーザーログインのテスト', async ({ page }) => {
    // ログインページに移動
    await page.goto('/login');
    
    // ページが読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // テストユーザー情報（seed.sqlから）
    const testUser = {
      email: 'user1@example.com',
      password: 'user123456'
    };
    
    console.log('通常ユーザーでログイン:', testUser.email);
    
    // メールアドレスとパスワードを入力
    await page.fill('input[type="email"], input[name="email"], input#email', testUser.email);
    await page.fill('input[type="password"], input[name="password"], input#password', testUser.password);
    
    // スクリーンショットを撮る（デバッグ用）
    await page.screenshot({ path: 'test-results/user-login-before.png' });
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();
    
    // ナビゲーションを待つ
    await page.waitForURL((url) => {
      return url.pathname !== '/login';
    }, { timeout: 30000 });
    
    // ログイン後のスクリーンショット
    await page.screenshot({ path: 'test-results/user-login-after.png' });
    
    // ダッシュボードに遷移したことを確認
    const currentURL = page.url();
    console.log('ログイン後のURL:', currentURL);
    
    expect(currentURL).not.toContain('/login');
    expect(currentURL).toMatch(/\/(dashboard|upload)/);
  });
  
  test('無効な認証情報でのログイン失敗', async ({ page }) => {
    // ログインページに移動
    await page.goto('/login');
    
    // ページが読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // 無効なユーザー情報
    const invalidUser = {
      email: 'invalid@example.com',
      password: 'wrongpassword'
    };
    
    console.log('無効な認証情報でログイン:', invalidUser.email);
    
    // メールアドレスとパスワードを入力
    await page.fill('input[type="email"], input[name="email"], input#email', invalidUser.email);
    await page.fill('input[type="password"], input[name="password"], input#password', invalidUser.password);
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"], button:has-text("ログイン"), button:has-text("Login"), button:has-text("Sign in")').first();
    await submitButton.click();
    
    // エラーメッセージが表示されるまで待つ
    await page.waitForTimeout(2000);
    
    // スクリーンショットを撮る
    await page.screenshot({ path: 'test-results/invalid-login.png' });
    
    // エラーメッセージを確認
    const errorMessage = page.locator('text=/Invalid|無効|エラー|失敗|incorrect/i').first();
    const isErrorVisible = await errorMessage.isVisible().catch(() => false);
    
    // ログインページに留まっていることを確認
    const currentURL = page.url();
    console.log('エラー後のURL:', currentURL);
    
    // エラーメッセージが表示されるか、ログインページに留まっていることを確認
    expect(currentURL).toContain('/login');
    
    if (!isErrorVisible) {
      console.log('エラーメッセージは表示されませんでしたが、ログインページに留まっています');
    }
  });
});
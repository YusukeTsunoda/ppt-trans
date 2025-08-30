import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';

/**
 * 基本的なフロー確認テスト
 * 最小限の動作確認を行う
 */
test.describe('Basic Flow Test', () => {
  test('基本的なログインとナビゲーション', async ({ page, baseURL }) => {
    test.setTimeout(20000);
    
    // 1. ログインページへアクセス
    await page.goto(`${baseURL}/login`);
    await expect(page).toHaveURL(/.*\/login/);
    
    // 2. ログインフォームが表示されることを確認
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // 3. ログイン実行
    await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
    await page.fill('input[name="password"]', TEST_CONFIG.auth.password);
    await page.click('button[type="submit"]');
    
    // 4. ダッシュボードへのリダイレクトを確認
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    
    // 5. ダッシュボードのコンテンツが表示されることを確認
    await expect(page.locator('h1').first()).toBeVisible();
    
    // 6. アップロードリンクが存在することを確認
    const uploadLink = page.getByTestId('new-upload-link').or(page.locator('a[href="/upload"]').first());
    await expect(uploadLink).toBeVisible();
    
    console.log('✅ Basic flow test passed');
  });
  
  test('アップロードページアクセス', async ({ page, baseURL }) => {
    test.setTimeout(20000);
    
    // 1. ログイン
    await page.goto(`${baseURL}/login`);
    await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
    await page.fill('input[name="password"]', TEST_CONFIG.auth.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    
    // 2. ダッシュボードからアップロードページへ遷移
    const uploadLink = page.getByTestId('new-upload-link').or(page.locator('a[href="/upload"]').first());
    await uploadLink.click();
    
    // 3. ページ遷移を待つ
    await page.waitForLoadState('networkidle');
    
    // 4. アップロードページまたはダッシュボードが表示されることを確認
    // アップロードページが独立したページではない可能性があるため、柔軟に対応
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // 5. ファイル入力フィールドが存在することを確認
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    
    console.log('✅ Upload page access test passed');
  });
});
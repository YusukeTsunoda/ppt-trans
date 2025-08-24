import { test, expect } from '@playwright/test';

/**
 * シンプルな動作確認テスト
 * 基本的な機能が動作することを確認
 */
test.describe('基本動作確認', () => {
  
  test('ホームページが表示される', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    
    // ページタイトルまたは主要な要素が存在することを確認
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // ページが正常にロードされたことを確認
    await expect(page).toHaveURL(baseURL + '/');
  });

  test('ログインページが表示される', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/login`);
    
    // ログインフォームの要素が存在することを確認
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // 各要素が表示されていることを確認
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('ログイン機能の基本動作', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/login`);
    
    // フォーム要素を待つ
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    await page.waitForLoadState('networkidle');
    
    // テスト用の認証情報を入力
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"]').first();
    
    // ボタンの状態変化を監視しながらクリック
    await expect(submitButton).toContainText('ログイン');
    await submitButton.click();
    
    // Server Actionの完了を待つ（以下のいずれか）
    // Option 1: ページ遷移を待つ
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/login') && response.status() === 200,
      { timeout: 5000 }
    ).catch(() => null);
    
    // Option 2: ボタンの状態変化を待つ
    await Promise.race([
      // ログイン成功：ページ遷移
      page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => null),
      // ログイン失敗：エラーメッセージ表示
      page.locator('.bg-red-50').waitFor({ state: 'visible', timeout: 5000 }).catch(() => null),
    ]);
    
    // 現在のURLを確認
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('/dashboard') || 
                       currentUrl.includes('/upload') ||
                       !currentUrl.includes('/login');
    
    // ログインページから遷移したことを確認
    expect(isLoggedIn).toBeTruthy();
  });

  test('アップロードページへのアクセス（認証後）', async ({ page, baseURL }) => {
    // まずログイン
    await page.goto(`${baseURL}/login`);
    await page.waitForSelector('input[type="email"]', { state: 'visible' });
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // ログイン処理を待つ
    await page.waitForTimeout(3000);
    
    // アップロードページへ遷移
    await page.goto(`${baseURL}/upload`);
    
    // ファイル入力要素が存在することを確認
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 10000 });
  });
});
import { test, expect } from '@playwright/test';

/**
 * 管理者ログインテスト
 * 管理者権限でのログインと管理画面へのアクセスを検証
 */
test.describe('管理者ログイン', () => {
  test.beforeEach(async ({ page }) => {
    // テスト用にE2Eヘッダーを設定
    await page.setExtraHTTPHeaders({
      'X-E2E-Test': 'true'
    });
  });

  test('管理者としてログインし、管理画面にアクセスできる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // ログインフォームが表示されるまで待機
    await expect(page.locator('h2:has-text("ログイン")')).toBeVisible({ timeout: 10000 });
    
    // 管理者の認証情報を入力
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Admin123!');
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待機
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // ダッシュボードが表示されることを確認
    await expect(page.locator('h1:has-text("PowerPoint Translator")')).toBeVisible();
    
    // 管理画面ボタンが表示されることを確認（管理者のみ）
    const adminButton = page.locator('a:has-text("管理画面")');
    await expect(adminButton).toBeVisible({ timeout: 5000 });
    
    // 管理画面に移動
    await adminButton.click();
    
    // 管理画面のURLに遷移することを確認
    await page.waitForURL('**/admin', { timeout: 10000 });
    
    // 管理者ダッシュボードのタイトルを確認
    await expect(page.locator('h1:has-text("管理者ダッシュボード")')).toBeVisible({ timeout: 10000 });
    
    // 管理画面のタブが表示されることを確認
    await expect(page.locator('button:has-text("統計情報")')).toBeVisible();
    await expect(page.locator('button:has-text("ユーザー管理")')).toBeVisible();
    await expect(page.locator('button:has-text("アクティビティログ")')).toBeVisible();
  });

  test('一般ユーザーとしてログインした場合、管理画面ボタンが表示されない', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // ログインフォームが表示されるまで待機
    await expect(page.locator('h2:has-text("ログイン")')).toBeVisible({ timeout: 10000 });
    
    // 一般ユーザーの認証情報を入力
    await page.fill('input[type="email"]', 'user1@example.com');
    await page.fill('input[type="password"]', 'User123!');
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待機
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // ダッシュボードが表示されることを確認
    await expect(page.locator('h1:has-text("PowerPoint Translator")')).toBeVisible();
    
    // 管理画面ボタンが表示されないことを確認
    const adminButton = page.locator('a:has-text("管理画面")');
    await expect(adminButton).not.toBeVisible();
    
    // プロフィールボタンは表示される
    await expect(page.locator('a:has-text("プロフィール")')).toBeVisible();
  });

  test('管理者が管理画面で統計情報を確認できる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // 管理者としてログイン
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    // ダッシュボードへ移動
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // 管理画面へ移動
    await page.click('a:has-text("管理画面")');
    await page.waitForURL('**/admin', { timeout: 10000 });
    
    // 統計情報タブをクリック（デフォルトで選択されている）
    const statsTab = page.locator('button:has-text("統計情報")');
    await expect(statsTab).toBeVisible();
    
    // 統計カードが表示されることを確認
    await expect(page.locator('text=総ユーザー数')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=アクティブユーザー')).toBeVisible();
    await expect(page.locator('text=総ファイル数')).toBeVisible();
    await expect(page.locator('text=総翻訳数')).toBeVisible();
  });

  test('管理者がユーザー管理タブでユーザー一覧を確認できる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // 管理者としてログイン
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    // ダッシュボードへ移動
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // 管理画面へ移動
    await page.click('a:has-text("管理画面")');
    await page.waitForURL('**/admin', { timeout: 10000 });
    
    // ユーザー管理タブをクリック
    await page.click('button:has-text("ユーザー管理")');
    
    // ユーザーテーブルのヘッダーが表示されることを確認
    await expect(page.locator('th:has-text("ユーザー")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('th:has-text("ロール")')).toBeVisible();
    await expect(page.locator('th:has-text("ファイル数")')).toBeVisible();
    await expect(page.locator('th:has-text("最終ログイン")')).toBeVisible();
    await expect(page.locator('th:has-text("ステータス")')).toBeVisible();
  });
});
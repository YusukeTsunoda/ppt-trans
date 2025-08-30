import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Server Actions Translation', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'test123456');
    await page.click('button[type="submit"]');
    
    // ダッシュボードへの遷移を待つ
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('should upload and translate file using Server Actions', async ({ page }) => {
    // アップロードページへ移動
    await page.click('a[data-testid="new-upload-link"]');
    await page.waitForURL('/upload');
    
    // ファイルアップロード
    const testFile = path.join(__dirname, '../fixtures/test-presentation.pptx');
    await page.setInputFiles('input[type="file"]', testFile);
    
    // アップロードボタンをクリック
    await page.click('button[data-testid="upload-submit"]');
    
    // ダッシュボードに戻る
    await page.waitForURL('/dashboard');
    
    // ファイルが表示されるのを待つ
    await expect(page.locator('[data-testid="file-list"]')).toBeVisible();
    
    // 翻訳ボタンをクリック（Server Action呼び出し）
    await page.click('button:has-text("🌐 翻訳"):first');
    
    // 翻訳完了を待つ（Server Actionの結果）
    await expect(page.locator('text=翻訳が完了しました')).toBeVisible({ timeout: 30000 });
  });

  test('should extract text in preview using Server Actions', async ({ page }) => {
    // テストファイルがある前提
    await page.goto('/dashboard');
    
    // プレビューボタンをクリック
    const previewButton = page.locator('a:has-text("📄 プレビュー"):first');
    if (await previewButton.isVisible()) {
      await previewButton.click();
      
      // プレビューページの読み込みを待つ
      await page.waitForURL(/\/preview\/.+/);
      
      // Server Actionによるテキスト抽出を待つ
      await expect(page.locator('text=テキスト抽出中')).toBeVisible();
      await expect(page.locator('[data-testid="slide-container"]')).toBeVisible({ timeout: 15000 });
      
      // 翻訳ボタンをクリック（Server Action呼び出し）
      await page.click('button:has-text("選択したスライドを翻訳")');
      
      // 翻訳完了を待つ
      await expect(page.locator('text=翻訳が完了しました')).toBeVisible({ timeout: 30000 });
    }
  });

  test('should handle Server Action errors gracefully', async ({ page }) => {
    await page.goto('/dashboard');
    
    // 存在しないファイルIDでプレビューページに直接アクセス
    await page.goto('/preview/non-existent-id');
    
    // エラーハンドリングを確認
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('Admin Server Actions', () => {
  test('should call admin Server Actions', async ({ page }) => {
    // 管理者としてログイン
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123456');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('/dashboard');
    
    // 管理画面へのリンクが表示されることを確認
    const adminLink = page.locator('a[href="/admin"]');
    if (await adminLink.isVisible()) {
      await adminLink.click();
      await page.waitForURL('/admin');
      
      // Server Actionによるデータ取得を確認
      await expect(page.locator('text=管理者ダッシュボード')).toBeVisible();
      await expect(page.locator('[data-testid="admin-stats"]')).toBeVisible();
    }
  });
});
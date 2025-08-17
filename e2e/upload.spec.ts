import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

test.describe('File Upload E2E Test', () => {
  test.beforeEach(async ({ page }) => {
    // テスト環境のURLに移動
    await page.goto('http://localhost:3001');
  });

  test('Complete flow: Register, Login, Upload PowerPoint file', async ({ page }) => {
    // 1. ユーザー登録
    const timestamp = Date.now();
    const testEmail = `test_${timestamp}@example.com`;
    const testPassword = 'TestPassword123!';

    // ホームページから登録ページへ
    await page.click('text=新規登録');
    await expect(page).toHaveURL(/.*\/register/);

    // 登録フォームに入力
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="confirmPassword"]', testPassword);
    
    // 登録ボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('ダッシュボード');

    // 2. ログアウトして再ログイン（セッション管理のテスト）
    await page.click('text=ログアウト');
    await page.waitForURL(/.*\//);

    // ログインページへ
    await page.click('text=ログイン');
    await expect(page).toHaveURL(/.*\/login/);

    // ログインフォームに入力
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    
    // ログインボタンをクリック
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // 3. ファイルアップロードページへ移動
    await page.click('text=ファイルをアップロード');
    await expect(page).toHaveURL(/.*\/upload/);

    // 4. PowerPointファイルをアップロード
    // テスト用のPPTXファイルを作成（実際のPPTXファイルのヘッダー）
    const pptxPath = join(__dirname, 'test.pptx');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pptxPath);

    // ファイル情報が表示されることを確認
    await expect(page.locator('text=選択されたファイル')).toBeVisible();
    await expect(page.locator('text=test.pptx')).toBeVisible();

    // アップロードボタンをクリック
    await page.click('button:has-text("アップロード")');

    // アップロード成功メッセージを待つ
    await expect(page.locator('text=ファイルが正常にアップロードされました')).toBeVisible({ timeout: 15000 });

    // ダッシュボードへの自動リダイレクトを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 5000 });

    // 5. アップロードされたファイルがダッシュボードに表示されることを確認
    await expect(page.locator('text=test.pptx')).toBeVisible();
  });

  test('Upload validation: reject non-PowerPoint files', async ({ page }) => {
    // 既存ユーザーでログイン
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // ダッシュボードを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // アップロードページへ
    await page.goto('http://localhost:3001/upload');

    // テキストファイルを選択しようとする
    const textFilePath = join(__dirname, 'test.txt');
    const fileInput = page.locator('input[type="file"]');
    
    // accept属性があることを確認
    await expect(fileInput).toHaveAttribute('accept', '.ppt,.pptx');

    // ファイルサイズ制限のテキストが表示されることを確認
    await expect(page.locator('text=最大50MB')).toBeVisible();
  });

  test('Upload error handling: network failure simulation', async ({ page, context }) => {
    // ログイン
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // アップロードページへ
    await page.goto('http://localhost:3001/upload');

    // ネットワークエラーをシミュレート
    await context.route('**/storage/v1/object/**', route => {
      route.abort('failed');
    });

    // ファイル選択
    const pptxPath = join(__dirname, 'test.pptx');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pptxPath);

    // アップロード試行
    await page.click('button:has-text("アップロード")');

    // エラーメッセージが表示されることを確認
    await expect(page.locator('text=アップロードに失敗しました')).toBeVisible({ timeout: 10000 });
  });

  test('Session persistence: upload after page refresh', async ({ page }) => {
    // ログイン
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // ページをリロード
    await page.reload();

    // まだログイン状態であることを確認
    await expect(page.locator('h1')).toContainText('ダッシュボード');

    // アップロードページへ移動できることを確認
    await page.click('text=ファイルをアップロード');
    await expect(page).toHaveURL(/.*\/upload/);

    // ファイル選択UIが表示されることを確認
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });
});
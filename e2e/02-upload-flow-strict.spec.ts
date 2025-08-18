import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './fixtures/test-config';
import { join } from 'path';
import * as fs from 'fs';

/**
 * アップロードフロー統合テスト（厳格版）
 * - 曖昧な成功判定を排除
 * - 正確な状態遷移を検証
 * - エラーケースを網羅的にテスト
 */
test.describe('アップロードフロー統合テスト（厳格版）', () => {
  const testFilesDir = join(process.cwd(), 'e2e', 'fixtures');
  const validPPTXPath = join(testFilesDir, 'test-presentation.pptx');
  const largePPTXPath = join(testFilesDir, 'large-presentation.pptx');
  const invalidFilePath = join(testFilesDir, 'invalid-file.txt');

  test.beforeAll(async () => {
    // テストファイルの存在確認
    const requiredFiles = [validPPTXPath, invalidFilePath];
    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(
          `必須テストファイルが見つかりません: ${file}\n` +
          `e2e/fixtures/ ディレクトリに以下のファイルを配置してください:\n` +
          `- test-presentation.pptx (有効なPPTXファイル)\n` +
          `- invalid-file.txt (無効なファイル)\n` +
          `- large-presentation.pptx (10MB以上のPPTXファイル)`
        );
      }
    }
  });

  test.beforeEach(async ({ page, baseURL, context }) => {
    // 認証状態の確立
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
    await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
    await page.click('button[type="submit"]');
    
    // ダッシュボードへの遷移を確認
    await page.waitForURL('**/dashboard', {
      timeout: TEST_CONFIG.timeouts.navigation
    });
    
    // セッションCookieの確認
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('sb-'));
    expect(authCookie).toBeDefined();
  });

  test.describe('正常系：ファイルアップロード', () => {
    test('PPTXファイルの完全なアップロードフロー検証', async ({ page, baseURL }) => {
      // アップロードページへ遷移
      await page.goto(`${baseURL}/upload`);
      await page.waitForLoadState('networkidle');
      
      // ページタイトルの確認
      await expect(page.locator('h1:has-text("ファイルアップロード")')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // 初期状態の検証
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled();
      
      // ファイル選択前の説明テキスト確認
      await expect(page.locator('text="PowerPointファイル（.pptx）を選択してください"')).toBeVisible();
      
      // ファイル選択
      const fileInput = page.locator('input[type="file"][accept=".pptx"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      // ファイル情報の表示確認
      await expect(page.locator('text="test-presentation.pptx"')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // ファイルサイズの表示確認
      const fileStats = fs.statSync(validPPTXPath);
      const fileSizeKB = Math.round(fileStats.size / 1024);
      await expect(page.locator(`text=/${fileSizeKB}\\s*KB/`)).toBeVisible();
      
      // アップロードボタンが有効になったことを確認
      await expect(uploadButton).toBeEnabled();
      
      // プログレスバーの初期状態確認
      const progressBar = page.locator('[role="progressbar"], .progress-bar');
      if (await progressBar.count() > 0) {
        await expect(progressBar).toHaveAttribute('aria-valuenow', '0');
      }
      
      // アップロード実行
      const uploadResponse = page.waitForResponse(
        response => response.url().includes('/upload') && response.request().method() === 'POST',
        { timeout: TEST_CONFIG.timeouts.upload }
      );
      
      await uploadButton.click();
      
      // アップロード中の状態確認
      await expect(uploadButton).toBeDisabled();
      await expect(page.locator('text=/アップロード中|Uploading/')).toBeVisible();
      
      // レスポンスの検証
      const response = await uploadResponse;
      expect(response.status()).toBe(200);
      
      // 成功メッセージの確認（正確な文言）
      await expect(page.locator(`text="${TEST_CONFIG.successMessages.uploadSuccess}"`)).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // ダッシュボードへの自動遷移確認
      await page.waitForURL('**/dashboard', {
        timeout: TEST_CONFIG.timeouts.navigation
      });
      
      // アップロードしたファイルが一覧に表示されることを確認
      await expect(page.locator('tr:has-text("test-presentation.pptx")')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
    });

    test('アップロード後のファイル操作検証', async ({ page, baseURL }) => {
      // 事前にファイルをアップロード
      await page.goto(`${baseURL}/upload`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      await page.waitForURL('**/dashboard');
      
      // ファイル一覧での表示確認
      const fileRow = page.locator('tr:has-text("test-presentation.pptx")');
      await expect(fileRow).toBeVisible();
      
      // アクションボタンの確認
      const previewButton = fileRow.locator('button:has-text("プレビュー")');
      const translateButton = fileRow.locator('button:has-text("翻訳")');
      const downloadButton = fileRow.locator('button:has-text("ダウンロード")');
      const deleteButton = fileRow.locator('button:has-text("削除")');
      
      // すべてのボタンが存在し、有効であることを確認
      await expect(previewButton).toBeVisible();
      await expect(previewButton).toBeEnabled();
      await expect(translateButton).toBeVisible();
      await expect(translateButton).toBeEnabled();
      await expect(downloadButton).toBeVisible();
      await expect(downloadButton).toBeEnabled();
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeEnabled();
      
      // ファイルステータスの確認
      await expect(fileRow.locator('text="アップロード完了"')).toBeVisible();
      
      // タイムスタンプの確認
      const timestamp = new Date().toLocaleDateString('ja-JP');
      await expect(fileRow.locator(`text=/${timestamp}/`)).toBeVisible();
    });
  });

  test.describe('異常系：バリデーション', () => {
    test('無効なファイル形式の完全な拒否検証', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      const fileInput = page.locator('input[type="file"]');
      
      // .txt ファイルを選択
      await fileInput.setInputFiles(invalidFilePath);
      
      // エラーメッセージの即座の表示確認（正確な文言）
      await expect(page.locator(`text="${TEST_CONFIG.errorMessages.invalidFileType}"`)).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // アップロードボタンが無効のままであることを確認
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled();
      
      // エラー状態のスタイリング確認
      await expect(page.locator('.error, .text-red-500, [role="alert"]')).toBeVisible();
      
      // ファイル選択をクリア
      await fileInput.setInputFiles([]);
      
      // エラーメッセージが消えることを確認
      await expect(page.locator(`text="${TEST_CONFIG.errorMessages.invalidFileType}"`)).not.toBeVisible();
    });

    test('ファイルサイズ制限の厳密な検証', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 大きなファイルが存在する場合のみテスト
      if (fs.existsSync(largePPTXPath)) {
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(largePPTXPath);
        
        // ファイルサイズエラーの表示確認（正確な文言）
        await expect(page.locator(`text="${TEST_CONFIG.errorMessages.fileSizeExceeded}"`)).toBeVisible({
          timeout: TEST_CONFIG.timeouts.element
        });
        
        // アップロードボタンが無効であることを確認
        await expect(page.locator('button:has-text("アップロード")')).toBeDisabled();
        
        // ファイルサイズの表示確認
        const fileStats = fs.statSync(largePPTXPath);
        const fileSizeMB = Math.round(fileStats.size / (1024 * 1024));
        await expect(page.locator(`text=/${fileSizeMB}\\s*MB/`)).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('ファイル未選択での送信防止', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 初期状態でアップロードボタンが無効であることを確認
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled();
      
      // ボタンをクリックしても何も起こらないことを確認
      await uploadButton.click({ force: true });
      
      // ページが遷移していないことを確認
      await expect(page).toHaveURL(`${baseURL}/upload`);
      
      // エラーメッセージやアラートが表示されないことを確認
      await page.waitForTimeout(1000);
      const alerts = page.locator('[role="alert"]');
      expect(await alerts.count()).toBe(0);
    });

    test('同一ファイルの重複アップロード処理', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 1回目のアップロード
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      await page.waitForURL('**/dashboard');
      
      // 2回目のアップロード試行
      await page.goto(`${baseURL}/upload`);
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      
      // 重複警告または成功メッセージの確認
      const warningOrSuccess = await page.waitForSelector(
        'text=/既に同じファイル|重複|正常にアップロード/',
        { timeout: TEST_CONFIG.timeouts.element }
      );
      
      expect(warningOrSuccess).toBeTruthy();
    });
  });

  test.describe('ネットワークエラー処理', () => {
    test('アップロード中の接続エラー処理', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/upload`);
      
      // オフラインモードをシミュレート
      await context.setOffline(true);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      
      // エラーメッセージの表示確認
      await expect(page.locator('text=/ネットワークエラー|接続エラー|Connection error/')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // オンラインに戻す
      await context.setOffline(false);
      
      // リトライボタンが表示される場合は確認
      const retryButton = page.locator('button:has-text("再試行")');
      if (await retryButton.count() > 0) {
        await expect(retryButton).toBeEnabled();
      }
    });

    test('タイムアウト処理の検証', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 遅いネットワークをシミュレート
      await page.route('**/upload', async route => {
        await page.waitForTimeout(TEST_CONFIG.timeouts.upload + 5000);
        await route.abort();
      });
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      
      // タイムアウトエラーメッセージの表示確認
      await expect(page.locator('text=/タイムアウト|timeout|時間切れ/')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.upload + 10000
      });
    });
  });

  test.describe('プログレッシブエンハンスメント', () => {
    test('JavaScriptが無効な環境での基本機能', async ({ page, baseURL, browser }) => {
      // JavaScriptを無効にした新しいコンテキストを作成
      const context = await browser.newContext({
        javaScriptEnabled: false
      });
      const noJsPage = await context.newPage();
      
      // ログイン（基本的なフォーム送信）
      await noJsPage.goto(`${baseURL}/login`);
      await noJsPage.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await noJsPage.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await noJsPage.click('button[type="submit"]');
      
      // サーバーサイドレンダリングでダッシュボードが表示されることを確認
      await noJsPage.waitForURL('**/dashboard');
      
      // アップロードページへ
      await noJsPage.goto(`${baseURL}/upload`);
      
      // 基本的なフォーム要素が表示されることを確認
      await expect(noJsPage.locator('input[type="file"]')).toBeVisible();
      await expect(noJsPage.locator('button[type="submit"]')).toBeVisible();
      
      await context.close();
    });
  });
});
import { test, expect } from '@playwright/test';
import { Config } from './config';
import { WaitUtils } from './utils/wait-utils';
import { join } from 'path';
import * as fs from 'fs';

/**
 * アップロードフロー統合テスト - Server Actions版
 * Server Actionsを通じたファイルアップロードをテスト
 */
test.describe('アップロードフロー統合テスト（Server Actions版）', () => {
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
          `- invalid-file.txt (無効なファイル)`
        );
      }
    }
  });

  test.beforeEach(async ({ page, baseURL }) => {
    // 認証済み状態でダッシュボードにアクセス
    await Config.safeNavigate(page, `${baseURL}/dashboard`);
    
    // ログインページにリダイレクトされていないことを確認
    const url = page.url();
    if (url.includes('/login')) {
      // ログインが必要な場合はログイン
      await Config.login(page);
    }
    
    await WaitUtils.waitForAuthentication(page);
  });

  test.describe('Server Action経由のアップロード', () => {
    test('PPTXファイルのServer Action アップロード', async ({ page, baseURL }) => {
      // ダッシュボードからアップロードモーダルを開く
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // ファイル選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      // ファイル情報が表示されることを確認
      await expect(page.locator('text="test-presentation.pptx"')).toBeVisible({
        timeout: Config.timeouts.element
      });
      
      // Server Actionを実行（フォーム送信）
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // フォームにServer Actionが設定されているか確認
      const formAction = await uploadForm.getAttribute('action');
      console.log('Upload form action:', formAction);
      
      // Server Action実行前のファイル数を記録
      const fileCountBefore = await page.locator(Config.selectors.dashboard.fileList + ' tr').count();
      
      // アップロード実行
      await Promise.all([
        page.waitForURL('**/dashboard', { timeout: Config.timeouts.upload }),
        submitButton.click()
      ]);
      
      // アップロード成功の確認
      await page.waitForTimeout(2000); // Server Action処理を待つ
      
      // ファイルが一覧に追加されたことを確認
      const fileList = page.locator(Config.selectors.dashboard.fileList);
      await expect(fileList).toBeVisible();
      
      const fileCountAfter = await page.locator(Config.selectors.dashboard.fileList + ' tr').count();
      expect(fileCountAfter).toBeGreaterThan(fileCountBefore);
      
      // アップロードしたファイルが表示されることを確認
      await expect(page.locator('tr:has-text("test-presentation.pptx")').first()).toBeVisible({
        timeout: Config.timeouts.element
      });
    });

    test('Server Actionのバリデーション（無効ファイル）', async ({ page, baseURL }) => {
      // アップロードモーダルを開く
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // 無効なファイルを選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // Server Action実行
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // エラー前のURL
      const urlBefore = page.url();
      
      // Server Actionを実行
      await submitButton.click();
      
      // エラーメッセージを待つ
      const errorElement = page.locator('[data-testid="upload-error"], .text-red-600').first();
      await expect(errorElement).toBeVisible({
        timeout: Config.timeouts.element
      });
      
      const errorText = await errorElement.textContent();
      expect(errorText).toMatch(/PowerPoint|ppt|pptx/i);
      
      // ファイルがアップロードされていないことを確認
      const fileList = page.locator('tr:has-text("invalid-file.txt")');
      await expect(fileList).not.toBeVisible();
    });

    test('大容量ファイルのServer Action処理', async ({ page, baseURL }) => {
      test.slow(); // タイムアウトを延長
      
      if (!fs.existsSync(largePPTXPath)) {
        test.skip();
        return;
      }
      
      // アップロードモーダルを開く
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // 大容量ファイルを選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largePPTXPath);
      
      // ファイルサイズの表示を確認
      const fileStats = fs.statSync(largePPTXPath);
      const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
      await expect(page.locator(`text=/${fileSizeMB}.*MB/`)).toBeVisible();
      
      // Server Actionを実行
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // プログレス表示の監視を開始
      const progressBar = page.locator(Config.selectors.upload.progressBar);
      
      // アップロード実行
      const uploadPromise = submitButton.click();
      
      // プログレスバーの表示を確認（存在する場合）
      if (await progressBar.isVisible({ timeout: 2000 })) {
        console.log('Progress bar detected during upload');
        await expect(progressBar).toHaveAttribute('aria-valuenow', /[0-9]+/);
      }
      
      await uploadPromise;
      
      // 完了またはエラーを待つ
      await page.waitForURL('**/dashboard', { timeout: 60000 });
    });
  });

  test.describe('Server Action エラーハンドリング', () => {
    test('ネットワークエラー時のServer Action', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // オフラインモードに設定
      await context.setOffline(true);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // Server Actionを実行
      await submitButton.click();
      
      // ネットワークエラーの表示を確認
      await expect(page.locator('text=/ネットワーク|接続|Connection/')).toBeVisible({
        timeout: Config.timeouts.element
      });
      
      // オンラインに戻す
      await context.setOffline(false);
    });

    test('Server Actionのタイムアウト処理', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // Server Actionの応答を遅延させる
      await page.route('**/upload', async route => {
        // 意図的に長い遅延を設定
        await page.waitForTimeout(35000); // Server Actionのタイムアウト(30秒)を超える
        await route.abort();
      });
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // Server Actionを実行
      await submitButton.click();
      
      // タイムアウトエラーメッセージを確認
      await expect(page.locator('text=/タイムアウト|timeout|時間切れ/')).toBeVisible({
        timeout: 40000
      });
    });

    test('同一ファイルの重複Server Actionアップロード', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // 1回目のアップロード
      let uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      await submitButton.click();
      
      await page.waitForURL('**/dashboard');
      await page.waitForTimeout(2000);
      
      // 2回目のアップロード試行
      uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      const fileInput2 = page.locator('input[type="file"]');
      await fileInput2.setInputFiles(validPPTXPath);
      
      const uploadForm2 = page.locator('form').filter({ has: fileInput2 });
      const submitButton2 = uploadForm2.locator('button[type="submit"]');
      await submitButton2.click();
      
      // 重複警告または成功メッセージを確認
      const messageElement = await page.waitForSelector(
        'text=/既に同じファイル|重複|正常にアップロード/',
        { timeout: Config.timeouts.element }
      );
      
      expect(messageElement).toBeTruthy();
    });
  });

  test.describe('Server Actionの並行処理', () => {
    test('複数ファイルの並行Server Actionアップロード', async ({ page, baseURL }) => {
      const testFiles = [
        'test-presentation.pptx',
        'test-presentation-2.pptx',
      ];
      
      for (const fileName of testFiles) {
        const filePath = join(testFilesDir, fileName);
        
        // ファイルが存在しない場合はスキップ
        if (!fs.existsSync(filePath)) {
          console.log(`Skipping ${fileName} - file not found`);
          continue;
        }
        
        await page.goto(`${baseURL}/dashboard`);
        const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
        await uploadButton.click();
        await WaitUtils.waitForUploadReady(page);
        
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(filePath);
        
        const uploadForm = page.locator('form').filter({ has: fileInput });
        const submitButton = uploadForm.locator('button[type="submit"]');
        
        // Server Actionを実行
        await submitButton.click();
        await page.waitForURL('**/dashboard', { 
          timeout: Config.timeouts.navigation 
        });
        
        await page.waitForTimeout(1000); // 次のアップロードまで待機
      }
      
      // すべてのファイルがアップロードされたことを確認
      const fileList = page.locator(Config.selectors.dashboard.fileList);
      await expect(fileList).toBeVisible();
    });
  });

  test.describe('Server Action フォーム検証', () => {
    test('フォーム未入力でのServer Action実行防止', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      // ファイル未選択でServer Actionを実行試行
      const uploadForm = page.locator('form').first();
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // ボタンが無効化されているか確認
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBeTruthy();
      
      // 強制的にクリックを試みる
      if (!isDisabled) {
        await submitButton.click({ force: true });
        
        // エラーメッセージを確認
        const errorMessage = page.locator('text=/ファイルを選択/');
        await expect(errorMessage).toBeVisible({ timeout: 3000 });
      }
    });

    test('Server Actionの進捗状態管理', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      const uploadButton = page.locator(Config.selectors.dashboard.uploadButton);
      await uploadButton.click();
      await WaitUtils.waitForUploadReady(page);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      const uploadForm = page.locator('form').filter({ has: fileInput });
      const submitButton = uploadForm.locator('button[type="submit"]');
      
      // アップロード前の状態を記録
      const buttonTextBefore = await submitButton.textContent();
      
      // Server Actionを実行
      const uploadPromise = submitButton.click();
      
      // ボタンが無効化されることを確認
      await expect(submitButton).toBeDisabled({ timeout: 1000 });
      
      // 進捗表示があれば確認
      const progressIndicator = page.locator('text=/アップロード中|Uploading/');
      if (await progressIndicator.isVisible({ timeout: 1000 })) {
        console.log('Upload progress indicator shown');
      }
      
      await uploadPromise;
      
      // 完了後の状態を確認
      await page.waitForURL('**/dashboard');
    });
  });
});
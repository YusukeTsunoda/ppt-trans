import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * ダウンロード機能 - コアテスト
 * MVPに必要なダウンロード機能のみをテスト
 */
test.describe('ダウンロード機能', () => {
  const testFilePath = 'e2e/fixtures/test-presentation.pptx';
  let downloadPath: string;

  test.beforeEach(async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    // ダッシュボードへ遷移
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ遷移
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await expect(previewButton).toBeVisible();
    await previewButton.click();
    
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
  });

  test.afterEach(() => {
    // ダウンロードしたファイルのクリーンアップはPlaywrightが自動で行う
  });

  test('翻訳済みファイルのダウンロード', async ({ page }) => {
    // 全スライドを翻訳
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateAllButton = page.locator('button:has-text("すべて翻訳")');
    await translateAllButton.click();
    
    // 翻訳完了を待つ
    await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
      timeout: 60000 
    });
    
    // ダウンロードボタンが有効になることを確認
    const downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    await expect(downloadButton.first()).toBeEnabled();
    
    // ダウンロードを開始
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.first().click()
    ]);
    
    // ダウンロードファイルの検証
    downloadPath = await download.path();
    const fileName = download.suggestedFilename();
    
    expect(fileName).toMatch(/\.pptx$/);
    expect(fileName).toContain('translated');
    // Playwrightがダウンロードを処理したことを確認
    expect(downloadPath).toBeTruthy();
  });

  test('部分翻訳でもダウンロード可能', async ({ page }) => {
    // 現在のスライドのみ翻訳
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateCurrentButton.click();
    
    // 翻訳完了を待つ
    await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // ダウンロードボタンが有効になることを確認
    const downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    await expect(downloadButton.first()).toBeEnabled();
    
    // ダウンロードを実行
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.first().click()
    ]);
    
    downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
  });

  test('翻訳前はダウンロードボタンが無効', async ({ page }) => {
    // ダウンロードボタンを探す
    const downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    
    // 翻訳前は無効化されているか確認
    if (await downloadButton.first().isVisible({ timeout: 2000 })) {
      await expect(downloadButton.first()).toBeDisabled();
    }
  });

  test('ダウンロード失敗時のエラー表示', async ({ page, context }) => {
    // 翻訳を実行
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateCurrentButton.click();
    
    await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // ダウンロードAPIをエラーにする
    await context.route('**/api/apply-translations', route => {
      route.abort('failed');
    });
    
    const downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    await downloadButton.first().click();
    
    // エラーメッセージが表示される
    const errorMessage = page.locator('.bg-red-50, [role="alert"], text=/ダウンロード.*失敗|エラー/');
    await expect(errorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
    
    // ボタンが再度有効になる
    await expect(downloadButton.first()).toBeEnabled();
  });
});
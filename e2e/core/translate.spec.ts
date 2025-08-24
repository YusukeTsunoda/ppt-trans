import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 翻訳機能 - コアテスト
 * MVPに必要な翻訳機能のみをテスト
 */
test.describe('翻訳機能', () => {
  const testFilePath = 'e2e/fixtures/test-presentation.pptx';

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

  test('単一スライドの翻訳', async ({ page }) => {
    // 言語選択
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    // 現在のスライドを翻訳
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await expect(translateCurrentButton).toBeEnabled();
    await translateCurrentButton.click();
    
    // 翻訳完了を待つ
    await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload
    });
    
    // 翻訳結果が表示されることを確認
    const translatedText = page.locator('[data-testid="translated-text"]').first();
    await expect(translatedText).not.toBeEmpty();
  });

  test('全スライドの一括翻訳', async ({ page }) => {
    // 言語選択
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    // すべて翻訳ボタンをクリック
    const translateAllButton = page.locator('button:has-text("すべて翻訳")');
    await expect(translateAllButton).toBeEnabled();
    await translateAllButton.click();
    
    // 翻訳中の状態を確認
    await expect(translateAllButton).toBeDisabled();
    
    // 翻訳完了を待つ
    await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
      timeout: 60000 
    });
    
    // 複数のスライドが翻訳されたことを確認
    const translatedIndicators = page.locator('.text-green-600, .bg-green-100');
    const count = await translatedIndicators.count();
    expect(count).toBeGreaterThan(0);
  });

  test('異なる言語への翻訳', async ({ page }) => {
    const languageSelect = page.locator('select').first();
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    
    // 中国語への翻訳
    await languageSelect.selectOption('zh');
    await translateCurrentButton.click();
    
    await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    const chineseText = await page.locator('[data-testid="translated-text"]').first().textContent();
    expect(chineseText).toBeTruthy();
    
    // 韓国語への翻訳
    await languageSelect.selectOption('ko');
    await translateCurrentButton.click();
    
    await expect(page.locator('text=/翻訳が完了/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    const koreanText = await page.locator('[data-testid="translated-text"]').first().textContent();
    expect(koreanText).toBeTruthy();
    expect(koreanText).not.toBe(chineseText);
  });

  test('翻訳APIエラー時のハンドリング', async ({ page, context }) => {
    // APIエラーをシミュレート
    await context.route('**/api/translate', route => {
      route.abort('failed');
    });
    
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateCurrentButton.click();
    
    // エラーメッセージが表示される
    const errorElement = page.locator('.bg-red-50, [role="alert"], text=/翻訳.*失敗/');
    await expect(errorElement.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
    
    // ボタンが有効に戻る
    await expect(translateCurrentButton).toBeEnabled();
  });
});
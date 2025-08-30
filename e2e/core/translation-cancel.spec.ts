import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 翻訳キャンセル機能 - MVPコアテスト
 * 翻訳処理のキャンセルと中断処理を検証
 */
test.describe('翻訳キャンセル機能', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
  });

  test('翻訳中のキャンセルボタン表示', async ({ page }) => {
    // 翻訳を開始
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("すべて翻訳")');
    await translateButton.click();
    
    // キャンセルボタンが表示される
    const cancelButton = page.locator('button:has-text("キャンセル"), button:has-text("中止"), button:has-text("Cancel")');
    await expect(cancelButton.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.quick 
    });
    
    // プログレスインジケーターが表示される
    const progressIndicator = page.locator('[role="progressbar"], .progress, .loading');
    await expect(progressIndicator.first()).toBeVisible();
  });

  test('翻訳キャンセル後の状態リセット', async ({ page }) => {
    // 翻訳を開始
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("すべて翻訳")');
    await translateButton.click();
    
    // 少し待ってからキャンセル
    await page.waitForTimeout(1000);
    
    const cancelButton = page.locator('button:has-text("キャンセル"), button:has-text("中止"), button:has-text("Cancel")');
    if (await cancelButton.first().isVisible()) {
      await cancelButton.first().click();
      
      // キャンセル確認ダイアログが表示される場合
      const confirmCancel = page.locator('button:has-text("確認"), button:has-text("はい"), button:has-text("Yes")');
      if (await confirmCancel.isVisible({ timeout: 1000 })) {
        await confirmCancel.click();
      }
      
      // 翻訳ボタンが再度有効になる
      await expect(translateButton).toBeEnabled({ 
        timeout: TEST_CONFIG.timeouts.standard 
      });
      
      // プログレスインジケーターが消える
      const progressIndicator = page.locator('[role="progressbar"], .progress, .loading');
      await expect(progressIndicator.first()).not.toBeVisible({ 
        timeout: TEST_CONFIG.timeouts.quick 
      });
      
      // キャンセルメッセージが表示される
      const cancelMessage = page.locator('text=/キャンセルされました|Cancelled|中止しました/');
      await expect(cancelMessage.first()).toBeVisible();
    }
  });

  test('部分的に完了した翻訳のキャンセル', async ({ page }) => {
    // 複数スライドの翻訳を開始
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateAllButton = page.locator('button:has-text("すべて翻訳")');
    await translateAllButton.click();
    
    // 一部が完了するまで待つ
    await page.waitForTimeout(2000);
    
    // 翻訳済みのスライドがあるか確認
    const translatedSlides = page.locator('[data-testid="translated-text"], .translated-slide');
    const translatedCount = await translatedSlides.count();
    
    // キャンセル
    const cancelButton = page.locator('button:has-text("キャンセル"), button:has-text("中止")');
    if (await cancelButton.first().isVisible()) {
      await cancelButton.first().click();
      
      // 部分的な結果が保持されているか確認
      if (translatedCount > 0) {
        // 翻訳済みのスライドは保持される
        await expect(translatedSlides.first()).toBeVisible();
        
        // 未翻訳のスライドがあることを示すメッセージ
        const partialMessage = page.locator('text=/一部.*完了|Partially completed|部分的/');
        await expect(partialMessage.first()).toBeVisible({ timeout: 2000 });
      }
    }
  });

  test('単一スライド翻訳のキャンセル', async ({ page }) => {
    // 現在のスライドのみ翻訳
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳"), button:has-text("このスライド")');
    await translateCurrentButton.first().click();
    
    // キャンセルボタンが表示される
    const cancelButton = page.locator('button:has-text("キャンセル"), button[aria-label="キャンセル"]');
    await expect(cancelButton.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.quick 
    });
    
    // キャンセルを実行
    await cancelButton.first().click();
    
    // 翻訳前の状態に戻る
    const originalText = page.locator('[data-testid="slide-text"]');
    await expect(originalText.first()).toBeVisible();
    
    const translatedText = page.locator('[data-testid="translated-text"]');
    await expect(translatedText.first()).not.toBeVisible({ timeout: 1000 });
  });

  test('キャンセル後の再翻訳', async ({ page }) => {
    // 翻訳を開始してキャンセル
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("翻訳")').first();
    await translateButton.click();
    
    await page.waitForTimeout(500);
    
    const cancelButton = page.locator('button:has-text("キャンセル")');
    if (await cancelButton.first().isVisible()) {
      await cancelButton.first().click();
      
      // キャンセル完了を待つ
      await expect(translateButton).toBeEnabled({ 
        timeout: TEST_CONFIG.timeouts.standard 
      });
      
      // 再度翻訳を実行
      await translateButton.click();
      
      // 正常に翻訳が開始される
      const progressIndicator = page.locator('[role="progressbar"], .progress');
      await expect(progressIndicator.first()).toBeVisible();
      
      // 翻訳が完了する
      await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({ 
        timeout: TEST_CONFIG.timeouts.upload 
      });
    }
  });

  test('ネットワークエラー時のキャンセル処理', async ({ page, context }) => {
    // 翻訳を開始
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("翻訳")').first();
    await translateButton.click();
    
    // ネットワークを切断
    await context.setOffline(true);
    
    // エラーまたはキャンセルオプションが表示される
    const errorOrCancel = page.locator('text=/エラー|Error|キャンセル|Cancel/');
    await expect(errorOrCancel.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.standard 
    });
    
    // キャンセルまたはリトライのオプションがある
    const actionButton = page.locator('button:has-text("キャンセル"), button:has-text("再試行")');
    await expect(actionButton.first()).toBeVisible();
    
    // ネットワークを復旧
    await context.setOffline(false);
  });
});
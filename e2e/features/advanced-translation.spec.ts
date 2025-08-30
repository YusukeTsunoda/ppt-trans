import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 高度な翻訳機能 - 追加機能テスト
 */
test.describe('高度な翻訳機能', () => {
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

  test('テーブルセルの個別翻訳', async ({ page }) => {
    // テーブルが含まれるスライドを探す
    const tableCells = page.locator('[data-testid*="table-cell"], .table-cell');
    
    if (await tableCells.count() > 0) {
      // 言語選択
      const languageSelect = page.locator('select').first();
      await languageSelect.selectOption('en');
      
      // 現在のスライドを翻訳
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
        timeout: TEST_CONFIG.timeouts.upload 
      });
      
      // テーブルセルが翻訳されたことを確認
      const translatedCells = page.locator('[data-testid*="translated-table-cell"]');
      expect(await translatedCells.count()).toBeGreaterThan(0);
    }
  });

  test('カスタムプロンプトでの翻訳', async ({ page }) => {
    // カスタムプロンプト入力欄があるか確認
    const customPromptInput = page.locator('textarea[placeholder*="カスタム"], input[placeholder*="プロンプト"]');
    
    if (await customPromptInput.isVisible({ timeout: 2000 })) {
      // カスタムプロンプトを入力
      await customPromptInput.fill('技術文書として正確に翻訳してください');
      
      // 言語選択
      const languageSelect = page.locator('select').first();
      await languageSelect.selectOption('en');
      
      // 翻訳実行
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
        timeout: TEST_CONFIG.timeouts.upload 
      });
    }
  });

  test('用語集を使用した翻訳', async ({ page }) => {
    // 用語集機能があるか確認
    const glossaryButton = page.locator('button:has-text("用語集"), button:has-text("Glossary")');
    
    if (await glossaryButton.isVisible({ timeout: 2000 })) {
      await glossaryButton.click();
      
      // 用語集モーダルが開くのを待つ
      const glossaryModal = page.locator('[role="dialog"], .modal').filter({ hasText: /用語/ });
      await expect(glossaryModal).toBeVisible();
      
      // 用語を追加
      const sourceTermInput = page.locator('input[placeholder*="元の用語"]');
      const targetTermInput = page.locator('input[placeholder*="翻訳後"]');
      
      if (await sourceTermInput.isVisible()) {
        await sourceTermInput.fill('AI');
        await targetTermInput.fill('人工知能');
        
        // 追加ボタンをクリック
        const addButton = page.locator('button:has-text("追加")');
        await addButton.click();
      }
      
      // モーダルを閉じる
      const closeButton = page.locator('button[aria-label="閉じる"], button:has-text("×")');
      await closeButton.click();
      
      // 翻訳を実行
      const languageSelect = page.locator('select').first();
      await languageSelect.selectOption('ja');
      
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
        timeout: TEST_CONFIG.timeouts.upload 
      });
    }
  });

  test('翻訳履歴の確認', async ({ page }) => {
    // 翻訳を実行
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    await expect(page.locator('text=/翻訳済み|翻訳が完了/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 履歴ボタンがあるか確認
    const historyButton = page.locator('button:has-text("履歴"), button:has-text("History")');
    
    if (await historyButton.isVisible({ timeout: 2000 })) {
      await historyButton.click();
      
      // 履歴モーダルまたはパネルが表示される
      const historyPanel = page.locator('[data-testid="translation-history"], .history-panel');
      await expect(historyPanel).toBeVisible();
      
      // 翻訳履歴が表示されることを確認
      const historyItems = page.locator('[data-testid="history-item"], .history-entry');
      expect(await historyItems.count()).toBeGreaterThan(0);
    }
  });
});
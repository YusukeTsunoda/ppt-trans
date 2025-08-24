import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * ファイル管理機能 - 追加機能テスト
 */
test.describe('ファイル管理機能', () => {
  const testFilePath = 'e2e/fixtures/test-presentation.pptx';

  test.beforeEach(async ({ page, baseURL }) => {
    // ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('ファイルの削除', async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // ファイルカードを探す
    const fileCard = page.locator('.bg-white, [data-testid="file-card"]').filter({ 
      hasText: 'test-presentation.pptx' 
    }).first();
    await expect(fileCard).toBeVisible();
    
    // 削除ボタンをクリック
    const deleteButton = fileCard.locator('button:has-text("削除"), button[aria-label="削除"]');
    await deleteButton.first().click();
    
    // 確認ダイアログまたはモーダル
    const confirmButton = page.locator('button:has-text("確認"), button:has-text("削除する")');
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
    
    // ファイルが削除されたことを確認
    await expect(fileCard).not.toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
  });

  test('ファイルの検索', async ({ page, baseURL }) => {
    // 複数ファイルをアップロード（可能な場合）
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // 検索ボックスがあるか確認
    const searchInput = page.locator('input[placeholder*="検索"], input[type="search"]');
    
    if (await searchInput.isVisible({ timeout: 2000 })) {
      // ファイル名で検索
      await searchInput.fill('test-presentation');
      
      // 検索結果が表示される
      const searchResults = page.locator('.bg-white, [data-testid="file-card"]').filter({ 
        hasText: 'test-presentation' 
      });
      await expect(searchResults.first()).toBeVisible();
      
      // 存在しないファイル名で検索
      await searchInput.fill('nonexistent-file');
      
      // 結果が表示されないことを確認
      await expect(searchResults.first()).not.toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
    }
  });

  test('ファイルの並べ替え', async ({ page, baseURL }) => {
    // ダッシュボードで並べ替えオプションを探す
    const sortDropdown = page.locator('select[aria-label*="並べ替え"], button:has-text("並べ替え")');
    
    if (await sortDropdown.isVisible({ timeout: 2000 })) {
      // 日付順で並べ替え
      const firstElement = sortDropdown.first();
      const tagName = await firstElement.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await firstElement.selectOption('date');
      } else {
        await sortDropdown.click();
        await page.locator('button:has-text("日付")').click();
      }
      
      // ファイルリストが更新されるのを待つ
      await page.waitForTimeout(500);
      
      // 名前順で並べ替え
      if (tagName === 'select') {
        await firstElement.selectOption('name');
      } else {
        await sortDropdown.click();
        await page.locator('button:has-text("名前")').click();
      }
      
      // ファイルリストが更新されるのを待つ
      await page.waitForTimeout(500);
    }
  });

  test('ファイル詳細の表示', async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // ファイルカードを探す
    const fileCard = page.locator('.bg-white, [data-testid="file-card"]').filter({ 
      hasText: 'test-presentation.pptx' 
    }).first();
    
    // 詳細ボタンまたはファイル名をクリック
    const detailsButton = fileCard.locator('button:has-text("詳細"), a:has-text("test-presentation")');
    
    if (await detailsButton.first().isVisible()) {
      await detailsButton.first().click();
      
      // 詳細モーダルまたはページが表示される
      const detailsPanel = page.locator('[data-testid="file-details"], .file-details');
      await expect(detailsPanel).toBeVisible();
      
      // ファイル情報が表示されることを確認
      await expect(page.locator('text=/サイズ|Size/')).toBeVisible();
      await expect(page.locator('text=/アップロード日|Upload date/')).toBeVisible();
    }
  });

  test('ファイルの名前変更', async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // ファイルカードを探す
    const fileCard = page.locator('.bg-white, [data-testid="file-card"]').filter({ 
      hasText: 'test-presentation.pptx' 
    }).first();
    
    // 名前変更ボタンを探す
    const renameButton = fileCard.locator('button:has-text("名前変更"), button[aria-label="名前変更"]');
    
    if (await renameButton.first().isVisible({ timeout: 2000 })) {
      await renameButton.first().click();
      
      // 名前変更入力欄が表示される
      const renameInput = page.locator('input[value*="test-presentation"]');
      await expect(renameInput).toBeVisible();
      
      // 新しい名前を入力
      await renameInput.fill('renamed-presentation.pptx');
      
      // 保存ボタンをクリック
      const saveButton = page.locator('button:has-text("保存"), button:has-text("OK")');
      await saveButton.click();
      
      // 新しい名前が表示されることを確認
      await expect(page.locator('text="renamed-presentation.pptx"')).toBeVisible();
    }
  });
});
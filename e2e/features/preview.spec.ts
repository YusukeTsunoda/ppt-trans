import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * プレビュー機能 - 追加機能テスト
 */
test.describe('プレビュー機能', () => {
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
  });

  test('プレビュー画面の表示', async ({ page }) => {
    // プレビューボタンをクリック
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await expect(previewButton).toBeVisible();
    await previewButton.click();
    
    // プレビューページへ遷移
    await expect(page).toHaveURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // プレビュー要素が表示される
    await expect(page.locator('h1').first()).toBeVisible();
    
    // スライドが表示される
    const slideContainer = page.locator('[data-testid="slide-container"], .slide-container');
    await expect(slideContainer).toBeVisible();
    
    // テキスト抽出が完了する
    await expect(page.locator('[data-testid="slide-text"]').first()).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload
    });
  });

  test('スライドナビゲーション', async ({ page }) => {
    // プレビューページへ遷移
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 次のスライドボタンがあるか確認
    const nextButton = page.locator('button[aria-label="次のスライド"], button:has-text("次へ")');
    const prevButton = page.locator('button[aria-label="前のスライド"], button:has-text("前へ")');
    
    if (await nextButton.isEnabled({ timeout: 2000 })) {
      // 次のスライドへ移動
      await nextButton.click();
      await page.waitForTimeout(500);
      
      // スライド番号が変わることを確認
      const slideNumber = page.locator('text=/\\d+\\s*\\/\\s*\\d+/');
      await expect(slideNumber).toBeVisible();
      
      // 前のスライドへ戻る
      if (await prevButton.isEnabled()) {
        await prevButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('サムネイル表示', async ({ page }) => {
    // プレビューページへ遷移
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // サムネイルサイドバーまたはボタンを探す
    const thumbnailToggle = page.locator('button:has-text("サムネイル"), button[aria-label*="thumbnail"]');
    
    if (await thumbnailToggle.isVisible({ timeout: 2000 })) {
      await thumbnailToggle.click();
      
      // サムネイル一覧が表示される
      const thumbnails = page.locator('[data-testid="thumbnail"], .thumbnail-item');
      await expect(thumbnails.first()).toBeVisible();
      
      // サムネイルをクリックしてスライドへジャンプ
      const secondThumbnail = thumbnails.nth(1);
      if (await secondThumbnail.isVisible()) {
        await secondThumbnail.click();
        await page.waitForTimeout(500);
        
        // スライドが切り替わることを確認
        const slideNumber = page.locator('text=/2\\s*\\/\\s*\\d+/');
        await expect(slideNumber).toBeVisible();
      }
    }
  });

  test('ズーム機能', async ({ page }) => {
    // プレビューページへ遷移
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // ズームボタンを探す
    const zoomInButton = page.locator('button[aria-label="ズームイン"], button:has-text("+")');
    const zoomOutButton = page.locator('button[aria-label="ズームアウト"], button:has-text("-")');
    const zoomResetButton = page.locator('button:has-text("100%"), button[aria-label="リセット"]');
    
    if (await zoomInButton.isVisible({ timeout: 2000 })) {
      // ズームイン
      await zoomInButton.click();
      await page.waitForTimeout(300);
      
      // スライドのサイズが変わることを確認
      const slideContainer = page.locator('[data-testid="slide-container"], .slide-container');
      const initialSize = await slideContainer.boundingBox();
      
      await zoomInButton.click();
      await page.waitForTimeout(300);
      
      const zoomedSize = await slideContainer.boundingBox();
      if (initialSize && zoomedSize) {
        expect(zoomedSize.width).toBeGreaterThan(initialSize.width);
      }
      
      // ズームリセット
      if (await zoomResetButton.isVisible()) {
        await zoomResetButton.click();
      }
    }
  });

  test('フルスクリーンモード', async ({ page }) => {
    // プレビューページへ遷移
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // フルスクリーンボタンを探す
    const fullscreenButton = page.locator('button[aria-label*="フルスクリーン"], button[aria-label*="fullscreen"]');
    
    if (await fullscreenButton.isVisible({ timeout: 2000 })) {
      // フルスクリーンへ
      await fullscreenButton.click();
      await page.waitForTimeout(500);
      
      // ESCキーで終了
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      // 通常モードに戻ることを確認
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });
});
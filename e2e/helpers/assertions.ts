import { expect, Page } from '@playwright/test';

/**
 * カスタムアサーションヘルパー
 * より厳密なテストのための共通アサーション関数
 */

export async function expectErrorMessage(page: Page, expectedText: string | RegExp) {
  const errorElement = page.locator('.error-message, [role="alert"], .bg-red-50').first();
  await expect(errorElement).toBeVisible();
  await expect(errorElement).toContainText(expectedText);
  
  // エラーが適切なARIA属性を持つことも確認
  const role = await errorElement.getAttribute('role');
  const ariaLive = await errorElement.getAttribute('aria-live');
  expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBeTruthy();
}

export async function expectSuccessMessage(page: Page, expectedText: string | RegExp) {
  const successElement = page.locator('.success-message, .bg-green-50, [role="status"]').first();
  await expect(successElement).toBeVisible();
  await expect(successElement).toContainText(expectedText);
}

export async function expectFileInDashboard(page: Page, fileName: string) {
  const fileRow = page.locator(`tr:has-text("${fileName}")`);
  await expect(fileRow).toBeVisible();
  
  // ファイル行に必要な要素がすべて含まれていることを確認
  const previewLink = fileRow.locator('a[href*="/preview/"]');
  const deleteButton = fileRow.locator('button:has-text("削除"), button[aria-label="削除"]');
  
  await expect(previewLink).toBeVisible();
  await expect(deleteButton).toBeVisible();
}

export async function expectTranslationComplete(page: Page) {
  // 翻訳完了の複数の指標を確認
  const translatedText = page.locator('[data-testid="translated-text"]');
  const downloadButton = page.locator('button:has-text("ダウンロード")');
  const successMessage = page.locator('text=/翻訳が完了|Translation complete/');
  
  // いずれかの完了指標が表示される
  const isComplete = await translatedText.first().isVisible({ timeout: 1000 }) ||
                     await downloadButton.isEnabled({ timeout: 1000 }) ||
                     await successMessage.isVisible({ timeout: 1000 });
  
  expect(isComplete).toBeTruthy();
}

export async function expectValidPPTXDownload(downloadPath: string | null, fileName: string) {
  expect(downloadPath).toBeTruthy();
  expect(fileName).toMatch(/\.pptx$/i);
  expect(fileName.toLowerCase()).toContain('translated');
}

export async function expectPagePerformance(page: Page, maxLoadTime: number = 3000) {
  const performanceMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      responseTime: navigation.responseEnd - navigation.requestStart
    };
  });
  
  expect(performanceMetrics.loadComplete).toBeLessThan(maxLoadTime);
  expect(performanceMetrics.responseTime).toBeLessThan(1000);
}
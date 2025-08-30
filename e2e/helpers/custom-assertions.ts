/**
 * カスタムアサーション
 * 業務固有の検証ロジックを再利用可能な形で定義
 */

import { Page, expect } from '@playwright/test';
import { expectations } from '../fixtures/test-data';

/**
 * ユーザーがログイン状態であることを確認
 */
export async function assertUserIsLoggedIn(page: Page, userEmail?: string): Promise<void> {
  // ユーザーメニューが表示されている
  await expect(
    page.locator(expectations.selectors.userMenu),
    'ユーザーメニューが表示されていません'
  ).toBeVisible({ timeout: 5000 });
  
  // URLがログインページでない
  await expect(page).not.toHaveURL(/\/login/, {
    message: 'ログインページにリダイレクトされています'
  });
  
  // ユーザーのメールアドレスが表示されている（指定された場合）
  if (userEmail) {
    await expect(
      page.locator(`text=${userEmail}`),
      `ユーザー ${userEmail} の情報が表示されていません`
    ).toBeVisible({ timeout: 5000 });
  }
}

/**
 * ユーザーがログアウト状態であることを確認
 */
export async function assertUserIsLoggedOut(page: Page): Promise<void> {
  // ユーザーメニューが表示されていない
  await expect(
    page.locator(expectations.selectors.userMenu),
    'ユーザーメニューが表示されています（ログアウトされていません）'
  ).not.toBeVisible();
  
  // ログインボタンが表示されている
  await expect(
    page.locator(expectations.selectors.loginButton).or(page.locator('a:has-text("ログイン")')),
    'ログインボタンが表示されていません'
  ).toBeVisible({ timeout: 5000 });
}

/**
 * ファイルアップロードが成功したことを確認
 */
export async function assertFileUploadSuccess(page: Page, fileName: string): Promise<void> {
  // 成功メッセージの確認
  await expect(
    page.locator(`text=${expectations.successMessages.upload}`),
    'アップロード成功メッセージが表示されていません'
  ).toBeVisible({ timeout: 15000 });
  
  // ファイル名が一覧に表示されている
  await expect(
    page.locator(`text=${fileName}`),
    `ファイル名 ${fileName} が一覧に表示されていません`
  ).toBeVisible({ timeout: 10000 });
  
  // エラーメッセージが表示されていない
  await expect(
    page.locator(expectations.selectors.errorMessage),
    'エラーメッセージが表示されています'
  ).not.toBeVisible();
}

/**
 * エラーメッセージが適切に表示されていることを確認
 */
export async function assertErrorMessage(
  page: Page, 
  errorType: keyof typeof expectations.errorMessages
): Promise<void> {
  const expectedPattern = expectations.errorMessages[errorType];
  
  // エラーメッセージが表示されている
  const errorElement = page.locator(expectations.selectors.errorMessage);
  await expect(
    errorElement,
    `${errorType} のエラーメッセージが表示されていません`
  ).toBeVisible({ timeout: 5000 });
  
  // メッセージ内容が期待値と一致
  const errorText = await errorElement.textContent();
  expect(
    errorText,
    `エラーメッセージが期待値と一致しません。実際: "${errorText}", 期待: ${expectedPattern}`
  ).toMatch(expectedPattern);
}

/**
 * ページのパフォーマンスを検証
 */
export async function assertPagePerformance(
  page: Page,
  maxLoadTime: number = 3000
): Promise<void> {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      loadComplete: navigation.loadEventEnd - navigation.fetchStart,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
    };
  });
  
  expect(
    metrics.loadComplete,
    `ページ読み込み時間が ${maxLoadTime}ms を超えています: ${metrics.loadComplete}ms`
  ).toBeLessThan(maxLoadTime);
  
  expect(
    metrics.firstContentfulPaint,
    `First Contentful Paint が 1500ms を超えています: ${metrics.firstContentfulPaint}ms`
  ).toBeLessThan(1500);
}

/**
 * フォームバリデーションが正しく動作していることを確認
 */
export async function assertFormValidation(
  page: Page,
  fieldName: string,
  invalidValue: string,
  expectedError: string | RegExp
): Promise<void> {
  // 無効な値を入力
  await page.fill(`[name="${fieldName}"]`, invalidValue);
  
  // フィールドからフォーカスを外す（バリデーショントリガー）
  await page.press(`[name="${fieldName}"]`, 'Tab');
  
  // エラーメッセージが表示される
  const errorSelector = `[data-error-for="${fieldName}"], .error-${fieldName}, [aria-describedby*="${fieldName}-error"]`;
  await expect(
    page.locator(errorSelector),
    `${fieldName} フィールドのバリデーションエラーが表示されていません`
  ).toBeVisible({ timeout: 2000 });
  
  // エラーメッセージの内容を確認
  const errorText = await page.locator(errorSelector).textContent();
  if (typeof expectedError === 'string') {
    expect(errorText).toContain(expectedError);
  } else {
    expect(errorText).toMatch(expectedError);
  }
}

/**
 * ファイルのダウンロードが成功したことを確認
 */
export async function assertFileDownload(
  page: Page,
  expectedFileName: string,
  expectedFileSize?: { min: number; max: number }
): Promise<void> {
  // ダウンロードイベントを待機
  const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
  
  // ダウンロードボタンをクリック
  await page.locator('button:has-text("ダウンロード"), a:has-text("ダウンロード")').first().click();
  
  const download = await downloadPromise;
  
  // ファイル名の確認
  const fileName = download.suggestedFilename();
  expect(
    fileName,
    `ダウンロードファイル名が期待値と異なります。実際: ${fileName}, 期待: ${expectedFileName}`
  ).toContain(expectedFileName);
  
  // ファイルサイズの確認（指定された場合）
  if (expectedFileSize) {
    const path = await download.path();
    if (path) {
      const fs = await import('fs');
      const stats = await fs.promises.stat(path);
      
      expect(
        stats.size,
        `ファイルサイズが範囲外です。実際: ${stats.size}, 期待: ${expectedFileSize.min}-${expectedFileSize.max}`
      ).toBeGreaterThanOrEqual(expectedFileSize.min);
      
      expect(stats.size).toBeLessThanOrEqual(expectedFileSize.max);
    }
  }
}

/**
 * アクセシビリティの基本チェック
 */
export async function assertAccessibility(page: Page): Promise<void> {
  // ページタイトルが設定されている
  const title = await page.title();
  expect(title, 'ページタイトルが設定されていません').toBeTruthy();
  
  // 言語属性が設定されている
  const lang = await page.getAttribute('html', 'lang');
  expect(lang, 'HTML lang属性が設定されていません').toBeTruthy();
  
  // フォーム要素にラベルが設定されている
  const inputs = await page.locator('input:not([type="hidden"]), select, textarea').all();
  for (const input of inputs) {
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledby = await input.getAttribute('aria-labelledby');
    
    if (id) {
      const label = await page.locator(`label[for="${id}"]`).count();
      expect(
        label > 0 || ariaLabel || ariaLabelledby,
        `入力要素 ${id} にラベルが設定されていません`
      ).toBeTruthy();
    }
  }
  
  // 画像に alt 属性が設定されている
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    const role = await img.getAttribute('role');
    expect(
      alt !== null || role === 'presentation',
      '画像に alt 属性が設定されていません'
    ).toBeTruthy();
  }
}
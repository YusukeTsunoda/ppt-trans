/**
 * 共通テストフロー
 * 重複しているテストロジックを再利用可能な形で定義
 */

import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';
import { TestUser, createTestUser } from '../fixtures/test-data';
import { LoginPage } from '../page-objects/LoginPage';
import { UploadPageImproved } from '../page-objects/UploadPageImproved';

/**
 * テストユーザーでログイン
 */
export async function loginAsTestUser(
  page: Page,
  user?: TestUser
): Promise<TestUser> {
  const testUser = user || await createTestUser();
  const loginPage = new LoginPage(page);
  
  await loginPage.navigate('/login');
  await loginPage.login(testUser.email, testUser.password);
  await page.waitForURL(/\/dashboard/, {
    timeout: testConfig.timeouts.navigation
  });
  
  return testUser;
}

/**
 * 管理者ユーザーでログイン
 */
export async function loginAsAdmin(page: Page): Promise<TestUser> {
  const adminUser = await createTestUser({ role: 'admin' });
  return loginAsTestUser(page, adminUser);
}

/**
 * ファイルアップロードの完全フロー
 */
export async function performFileUpload(
  page: Page,
  filePath: string
): Promise<{
  success: boolean;
  fileName: string;
  uploadTime: number;
  error?: string;
}> {
  const uploadPage = new UploadPageImproved(page);
  const startTime = Date.now();
  
  try {
    await uploadPage.navigateToUploadPage();
    await uploadPage.selectFile(filePath);
    
    const fileName = await uploadPage.getSelectedFileName() || '';
    
    await uploadPage.clickUploadButton();
    await uploadPage.waitForUploadSuccess();
    
    return {
      success: true,
      fileName,
      uploadTime: Date.now() - startTime
    };
  } catch (error) {
    const errorMessage = await uploadPage.getUploadError();
    return {
      success: false,
      fileName: '',
      uploadTime: Date.now() - startTime,
      error: errorMessage || String(error)
    };
  }
}

/**
 * ログアウト処理
 */
export async function logout(page: Page): Promise<void> {
  // ユーザーメニューをクリック
  const userMenu = page.locator('[data-testid="user-menu"], [aria-label="User menu"]');
  if (await userMenu.isVisible()) {
    await userMenu.click();
  }
  
  // ログアウトボタンをクリック
  await page.click('[data-testid="logout-button"], button:has-text("ログアウト")');
  
  // ログインページへのリダイレクトを待つ
  await page.waitForURL(/\/login/, {
    timeout: testConfig.timeouts.navigation
  });
}

/**
 * 保護されたページへのアクセステスト
 */
export async function testProtectedPageAccess(
  page: Page,
  route: string
): Promise<{
  redirected: boolean;
  redirectUrl: string;
  hasCallbackUrl: boolean;
}> {
  await page.goto(`${testConfig.baseUrl}${route}`);
  
  // リダイレクトを待つ
  await page.waitForURL(/\/login/, {
    timeout: testConfig.timeouts.navigation
  });
  
  const currentUrl = page.url();
  const url = new URL(currentUrl);
  
  return {
    redirected: currentUrl.includes('/login'),
    redirectUrl: currentUrl,
    hasCallbackUrl: url.searchParams.has('callbackUrl')
  };
}

/**
 * フォームバリデーションエラーのテスト
 */
export async function testFormValidationError(
  page: Page,
  fieldName: string,
  invalidValue: string
): Promise<string | null> {
  // フィールドに無効な値を入力
  await page.fill(`[name="${fieldName}"]`, invalidValue);
  
  // フィールドからフォーカスを外す
  await page.press(`[name="${fieldName}"]`, 'Tab');
  
  // エラーメッセージを取得
  const errorSelectors = [
    `[data-testid="${fieldName}-error"]`,
    `[data-error-for="${fieldName}"]`,
    `.error-${fieldName}`,
    `[aria-describedby*="${fieldName}-error"]`
  ];
  
  for (const selector of errorSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible()) {
      return await element.textContent();
    }
  }
  
  return null;
}

/**
 * ネットワークエラーのシミュレーション
 */
export async function simulateNetworkError(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>
): Promise<string | null> {
  // ネットワークエラーを設定
  await page.route(urlPattern, route => {
    route.abort('failed');
  });
  
  // アクションを実行
  await action();
  
  // エラーメッセージを探す
  const errorSelectors = [
    '[data-testid="network-error"]',
    '[data-testid="error-message"]',
    '[role="alert"]',
    '.error-message'
  ];
  
  for (const selector of errorSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible()) {
      return await element.textContent();
    }
  }
  
  return null;
}

/**
 * パフォーマンス計測ラッパー
 */
export async function measurePerformance<T>(
  name: string,
  action: () => Promise<T>
): Promise<{
  result: T;
  duration: number;
  metrics: {
    startTime: number;
    endTime: number;
    name: string;
  };
}> {
  const startTime = Date.now();
  const result = await action();
  const endTime = Date.now();
  
  return {
    result,
    duration: endTime - startTime,
    metrics: {
      startTime,
      endTime,
      name
    }
  };
}

/**
 * セキュリティペイロードのテスト
 */
export async function testSecurityPayload(
  page: Page,
  fieldSelector: string,
  payload: string,
  checkForAlert: boolean = true
): Promise<{
  alertFired: boolean;
  sanitized: boolean;
  displayedValue: string;
}> {
  let alertFired = false;
  
  if (checkForAlert) {
    page.on('dialog', async dialog => {
      alertFired = true;
      await dialog.dismiss();
    });
  }
  
  // ペイロードを入力
  await page.fill(fieldSelector, payload);
  
  // 少し待機
  await page.waitForTimeout(1000);
  
  // 表示された値を取得
  const displayedValue = await page.inputValue(fieldSelector);
  
  return {
    alertFired,
    sanitized: !displayedValue.includes('<script>') && !displayedValue.includes('javascript:'),
    displayedValue
  };
}
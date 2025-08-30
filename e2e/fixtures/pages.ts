import { test as base } from '@playwright/test';
import { UploadPage } from '../pages/UploadPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';

/**
 * Page Objectsを提供するカスタムフィクスチャ
 */
type Pages = {
  uploadPage: UploadPage;
  dashboardPage: DashboardPage;
  loginPage: LoginPage;
};

/**
 * 認証済みユーザー情報
 */
type AuthenticatedUser = {
  email: string;
  password: string;
  isAuthenticated: boolean;
};

/**
 * 拡張されたテストフィクスチャ
 */
export const test = base.extend<Pages & { authenticatedUser: AuthenticatedUser }>({
  // Page Objects
  uploadPage: async ({ page }, use) => {
    await use(new UploadPage(page));
  },
  
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  
  // 認証済みユーザーフィクスチャ
  authenticatedUser: async ({ page, baseURL }, use) => {
    const user = {
      email: 'test@example.com',
      password: 'password123',
      isAuthenticated: false
    };
    
    // ログイン処理
    await page.goto(`${baseURL}/login`);
    
    // ログインフォームが表示されるまで待つ
    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 });
    
    // 認証情報を入力
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"]:has-text("ログイン"), button[type="submit"]:has-text("Login")').first();
    await submitButton.click();
    
    // ダッシュボードへの遷移を待つ
    try {
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      user.isAuthenticated = true;
    } catch {
      // ログインに失敗した場合のフォールバック
      user.isAuthenticated = false;
      console.error('認証に失敗しました');
    }
    
    await use(user);
    
    // クリーンアップ（オプション）
    // ログアウト処理など
  }
});

export { expect } from '@playwright/test';
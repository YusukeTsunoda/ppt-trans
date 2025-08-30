import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';
import { APIRoutesHelper } from '../helpers/api-routes-helper';

/**
 * 管理者認証フロー - E2Eテスト
 * ローカルSupabaseのシードデータを使用
 */
test.describe('管理者認証フロー', () => {
  let loginPage: LoginPage;
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test.describe('管理者ログイン', () => {
    test('管理者として正常にログイン', async ({ page }) => {
      await loginPage.goto();
      
      // 管理者ユーザー情報を取得（seed.sqlから）
      const adminUser = TEST_CONFIG.users.admin();
      console.log('Testing admin login with:', adminUser.email);
      
      // ログインフォームに入力
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      
      // ログインボタンをクリック
      await Promise.all([
        page.waitForNavigation({ 
          url: /\/(dashboard|admin)/, 
          timeout: 15000 
        }),
        page.click('button[type="submit"]')
      ]);
      
      // 管理者ダッシュボードに遷移したことを確認
      const currentURL = page.url();
      expect(currentURL).toMatch(/\/(dashboard|admin)/);
      
      // 管理者UI要素の確認
      // ヘッダーまたはナビゲーションが表示されることを確認
      const adminIndicator = page.locator('text=/admin|管理者|Administrator/i').first();
      await expect(adminIndicator).toBeVisible({ timeout: 10000 });
      
      // ログアウトボタンが存在することを確認
      const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout")').first();
      await expect(logoutButton).toBeVisible();
    });

    test('管理者権限の確認', async ({ page }) => {
      await loginPage.goto();
      
      // 管理者としてログイン
      const adminUser = TEST_CONFIG.users.admin();
      
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }),
        page.click('button[type="submit"]')
      ]);
      
      // 管理者専用機能へのアクセスを確認
      // 管理者ダッシュボードまたは管理メニューが表示されることを確認
      const adminElements = await page.locator('text=/管理|Admin|統計|Statistics|ユーザー管理|User Management/i').count();
      expect(adminElements).toBeGreaterThan(0);
    });
  });

  test.describe('通常ユーザーログイン', () => {
    test('通常ユーザーとして正常にログイン', async ({ page }) => {
      await loginPage.goto();
      
      // 通常ユーザー情報を取得（seed.sqlから）
      const testUser = TEST_CONFIG.users.standard();
      console.log('Testing user login with:', testUser.email);
      
      // ログインフォームに入力
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      
      // ログインボタンをクリック
      await Promise.all([
        page.waitForNavigation({ 
          url: /\/dashboard/, 
          timeout: 15000 
        }),
        page.click('button[type="submit"]')
      ]);
      
      // ダッシュボードに遷移したことを確認
      await expect(page).toHaveURL(/\/dashboard/);
      
      // ユーザーダッシュボードの要素を確認
      const dashboardTitle = page.locator('h1, h2').filter({ hasText: /ダッシュボード|Dashboard|ファイル|Files/i }).first();
      await expect(dashboardTitle).toBeVisible({ timeout: 10000 });
      
      // ログアウトボタンが存在することを確認
      const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout")').first();
      await expect(logoutButton).toBeVisible();
    });

    test('通常ユーザーは管理者機能にアクセスできない', async ({ page }) => {
      await loginPage.goto();
      
      // 通常ユーザーとしてログイン
      const testUser = TEST_CONFIG.users.standard();
      
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }),
        page.click('button[type="submit"]')
      ]);
      
      // 管理者ページに直接アクセスを試みる
      await page.goto('/admin', { waitUntil: 'networkidle' });
      
      // 管理者ページにアクセスできないことを確認（リダイレクトまたはエラー）
      const currentURL = page.url();
      expect(currentURL).not.toMatch(/\/admin/);
      
      // エラーメッセージまたはリダイレクト先を確認
      const isOnDashboard = currentURL.includes('/dashboard');
      const isOnLogin = currentURL.includes('/login');
      const hasErrorMessage = await page.locator('text=/権限がありません|Unauthorized|Access Denied/i').count() > 0;
      
      expect(isOnDashboard || isOnLogin || hasErrorMessage).toBeTruthy();
    });
  });

  test.describe('ログアウト機能', () => {
    test('管理者のログアウト', async ({ page }) => {
      await loginPage.goto();
      
      // 管理者としてログイン
      const adminUser = TEST_CONFIG.users.admin();
      
      await page.fill('input[name="email"]', adminUser.email);
      await page.fill('input[name="password"]', adminUser.password);
      
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }),
        page.click('button[type="submit"]')
      ]);
      
      // ログアウトボタンをクリック
      const logoutButton = page.locator('button:has-text("ログアウト"), button:has-text("Logout")').first();
      await expect(logoutButton).toBeVisible();
      
      await Promise.all([
        page.waitForNavigation({ 
          url: /\/(login|$)/, 
          timeout: 15000 
        }),
        logoutButton.click()
      ]);
      
      // ログインページまたはホームページにリダイレクトされることを確認
      const currentURL = page.url();
      expect(currentURL).toMatch(/\/(login|$)/);
      
      // ログインフォームが表示されることを確認
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  });
});
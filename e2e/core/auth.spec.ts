import { test, expect } from '@playwright/test';
import { TEST_CONFIG, generateTestUser } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';

/**
 * 認証フロー - コアテスト
 * MVPに必要な認証機能のみをテスト
 */
test.describe('認証フロー', () => {
  let loginPage: LoginPage;
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test.describe('ログイン機能', () => {
    test('正常なログイン', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.loginAsStandardUser();
      await loginPage.expectLoginSuccess();
      
      // ダッシュボードの基本要素を確認
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('button:has-text("ログアウト")')).toBeVisible();
    });

    test('無効な認証情報でのログイン失敗', async ({ page }) => {
      await loginPage.navigate();
      await loginPage.login('invalid@example.com', 'wrongpassword');
      
      // エラーメッセージの表示を確認
      const errorElement = page.locator('.bg-red-50, [role="alert"], .error-message');
      await expect(errorElement.first()).toBeVisible({
        timeout: TEST_CONFIG.timeouts.quick
      });
      
      // ログインページに留まることを確認
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('空のフィールドでの送信防止', async ({ page }) => {
      await loginPage.navigate();
      
      // 空のフォームで送信
      await loginPage.submit();
      
      // HTML5バリデーションまたはフォームの無効状態を確認
      const emailInput = loginPage.emailInput;
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBeTruthy();
    });
  });

  test.describe('ユーザー登録', () => {
    test('新規ユーザー登録フロー', async ({ page, baseURL }) => {
      const newUser = generateTestUser();
      
      await page.goto(`${baseURL}/register`);
      await page.waitForLoadState('networkidle');
      
      // 登録フォームに入力
      await page.fill('input[name="email"]', newUser.email);
      await page.fill('input[name="password"]', newUser.password);
      await page.fill('input[name="confirmPassword"]', newUser.password);
      
      // 送信
      await page.click('button[type="submit"]');
      
      // 成功後のリダイレクトを確認（ダッシュボードまたはログインページ）
      await page.waitForURL((url) => {
        return url.pathname === '/dashboard' || url.pathname === '/login';
      }, { timeout: TEST_CONFIG.timeouts.navigation });
    });

    test('パスワード不一致エラー', async ({ page, baseURL }) => {
      const newUser = generateTestUser();
      
      await page.goto(`${baseURL}/register`);
      
      await page.fill('input[name="email"]', newUser.email);
      await page.fill('input[name="password"]', newUser.password);
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      const errorElement = page.locator('text=/パスワードが一致しません|Passwords do not match/i');
      await expect(errorElement).toBeVisible({
        timeout: TEST_CONFIG.timeouts.quick
      });
      
      // 登録ページに留まることを確認
      await expect(page).toHaveURL(/.*\/register/);
    });
  });

  test.describe('ログアウト', () => {
    test('ログアウト機能', async ({ page, baseURL }) => {
      // まずログインする
      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.loginAsStandardUser();
      await loginPage.expectLoginSuccess();
      
      // ログアウトボタンをクリック
      const logoutButton = page.locator('button:has-text("ログアウト")');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        
        // ホームページまたはログインページへのリダイレクトを確認
        await page.waitForURL((url) => {
          return url.pathname === '/' || url.pathname === '/login';
        }, { timeout: TEST_CONFIG.timeouts.navigation });
      }
    });
  });
});
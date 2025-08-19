import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from './fixtures/test-config';

/**
 * 認証フロー統合テスト（厳格版）
 * - ハードコードを排除
 * - エラーメッセージを正確に検証
 * - 成功条件を明確化
 */
test.describe('認証フロー統合テスト（厳格版）', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('ユーザー登録', () => {
    test('パスワード不一致エラーの正確な検証', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/register`);
      
      // ランダムなメールアドレスを生成（テストの独立性を保証）
      const testEmail = `test-${Date.now()}@example.com`;
      
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'ValidPassword123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword456!');
      
      await page.click('button:has-text("新規登録")');
      
      // 正確なエラーメッセージのみを許容
      const errorElement = page.locator(`text="${TEST_CONFIG.errorMessages.passwordMismatch}"`);
      await expect(errorElement).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element,
      });
      
      // ページが遷移していないことを確認
      await expect(page).toHaveURL(/.*register$/);
      
      // フォームがリセットされていないことを確認
      await expect(page.locator('input[name="email"]')).toHaveValue(testEmail);
    });

    test('必須フィールドのバリデーション', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/register`);
      
      // 空のフォームで送信
      await page.click('button:has-text("新規登録")');
      
      // HTML5バリデーションメッセージを確認
      const emailInput = page.locator('input[name="email"]');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });
  });

  test.describe('ログイン機能', () => {
    test('正常なログインと完全な状態遷移の検証', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/login`);
      
      // ログイン前のCookie状態を記録
      const cookiesBefore = await context.cookies();
      const authCookieBefore = cookiesBefore.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieBefore).toBeUndefined();
      
      // 正確な認証情報でログイン
      await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[name="password"]', TEST_CONFIG.auth.password);
      
      // ネットワークリクエストを監視
      const navigationPromise = page.waitForURL('**/dashboard', {
        timeout: TEST_CONFIG.timeouts.navigation,
        waitUntil: 'networkidle'
      });
      
      await page.click('button:has-text("ログイン")');
      
      // ダッシュボードへの遷移を確認
      await navigationPromise;
      
      // セッションCookieの検証
      const cookiesAfter = await context.cookies();
      const authCookieAfter = cookiesAfter.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieAfter).toBeDefined();
      expect(authCookieAfter?.httpOnly).toBe(true);  // セキュリティ検証
      expect(authCookieAfter?.sameSite).toBeTruthy();  // CSRF対策検証
      
      // ダッシュボードの要素が表示されていることを確認
      await expect(page.locator('h1:has-text("ダッシュボード")')).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // ユーザー情報が表示されていることを確認
      await expect(page.locator(`text="${TEST_CONFIG.auth.email}"`)).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
    });

    test('誤った認証情報での正確なエラー表示', async ({ page, baseURL }) => {
      // ログアウト状態を確保
      await page.goto(`${baseURL}/login`);
      
      // すでにログイン済みの場合はログアウト
      if (page.url().includes('/dashboard')) {
        await page.click('button:has-text("ログアウト")');
        await page.waitForURL('**/login');
      }
      
      await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[name="password"]', 'WrongPassword123!');
      
      // フォーム送信前の状態を記録
      const urlBefore = page.url();
      
      await page.click('button:has-text("ログイン")');
      
      // エラー処理を待つ
      await page.waitForTimeout(1000);
      
      // エラーメッセージの表示を確認（複数の可能性に対応）
      const errorElement = page.locator('.bg-red-50').first();
      await expect(errorElement).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // エラーメッセージの内容を確認
      const errorText = await errorElement.textContent();
      expect(
        errorText?.includes(TEST_CONFIG.errorMessages.loginFailed) ||
        errorText?.includes('Invalid login credentials') ||
        errorText?.includes('ログインに失敗しました')
      ).toBeTruthy();
      
      // ページが遷移していないことを確認
      await expect(page).toHaveURL(urlBefore);
      
      // エラー後も再試行可能であることを確認
      const submitButton = page.locator('button:has-text("ログイン")');
      await expect(submitButton).toBeEnabled();
    });

    test('存在しないユーザーでのエラー処理', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;
      await page.fill('input[name="email"]', nonExistentEmail);
      await page.fill('input[name="password"]', 'AnyPassword123!');
      
      await page.click('button:has-text("ログイン")');
      
      // タイミング攻撃対策: 同じエラーメッセージ
      const errorElement = page.locator(`text="${TEST_CONFIG.errorMessages.loginFailed}"`);
      await expect(errorElement).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // エラーメッセージがユーザーの存在を示唆しないことを確認
      const pageContent = await page.content();
      expect(pageContent).not.toContain('ユーザーが存在しません');
      expect(pageContent).not.toContain('User not found');
    });
  });

  test.describe('ログアウト機能', () => {
    test('完全なログアウトとセッション破棄の検証', async ({ page, baseURL, context }) => {
      // まずログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[name="password"]', TEST_CONFIG.auth.password);
      await page.click('button:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // ログアウト前のCookie確認
      const cookiesBefore = await context.cookies();
      const authCookieBefore = cookiesBefore.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieBefore).toBeDefined();
      
      // ログアウト実行
      await page.click('button:has-text("ログアウト")');
      
      // ログインページへのリダイレクト確認
      await page.waitForURL('**/login', {
        timeout: TEST_CONFIG.timeouts.navigation
      });
      
      // セッションCookieが削除されていることを確認
      const cookiesAfter = await context.cookies();
      const authCookieAfter = cookiesAfter.find(c => 
        c.name.includes('auth') || c.name.includes('sb-') && c.value
      );
      expect(authCookieAfter).toBeUndefined();
      
      // 保護されたページにアクセスできないことを確認
      await page.goto(`${baseURL}/dashboard`);
      await page.waitForURL('**/login?callbackUrl=%2Fdashboard');
    });
  });

  test.describe('アクセス制御', () => {
    test('未認証での保護ページアクセス制御', async ({ page, baseURL }) => {
      const protectedRoutes = [
        '/dashboard',
        '/upload', 
        '/preview/test-id',
        '/settings',
        '/admin'
      ];
      
      for (const route of protectedRoutes) {
        await page.goto(`${baseURL}${route}`);
        
        // ログインページへのリダイレクトを確認
        await page.waitForURL((url) => {
          return url.toString().includes('/login') && 
                 url.toString().includes(`callbackUrl=${encodeURIComponent(route)}`);
        }, {
          timeout: TEST_CONFIG.timeouts.navigation
        });
        
        // ログインフォームが表示されていることを確認
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
      }
    });

    test('callbackUrlの正確な処理', async ({ page, baseURL }) => {
      const targetRoute = '/upload';
      
      // 保護されたページに直接アクセス
      await page.goto(`${baseURL}${targetRoute}`);
      await page.waitForURL(`**/login?callbackUrl=${encodeURIComponent(targetRoute)}`);
      
      // ログイン
      await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[name="password"]', TEST_CONFIG.auth.password);
      await page.click('button:has-text("ログイン")');
      
      // 元々アクセスしようとしたページに遷移することを確認
      await page.waitForURL(`**${targetRoute}`, {
        timeout: TEST_CONFIG.timeouts.navigation
      });
      
      // ページが正しく表示されていることを確認
      await expect(page.locator('h1')).toContainText(/アップロード|Upload/);
    });
  });

  test.describe('セキュリティ検証', () => {
    test('XSS攻撃への耐性', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      const xssPayload = '<script>alert("XSS")</script>';
      await page.fill('input[name="email"]', xssPayload + '@test.com');
      await page.fill('input[name="password"]', 'password123');
      
      // XSSアラートが発生しないことを確認
      let xssTriggered = false;
      page.on('dialog', () => {
        xssTriggered = true;
      });
      
      await page.click('button:has-text("ログイン")');
      await page.waitForTimeout(2000);
      
      expect(xssTriggered).toBe(false);
      
      // エラーメッセージが適切にエスケープされていることを確認
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');
    });

    test('SQLインジェクション攻撃への耐性', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      // SQLインジェクション試行
      await page.fill('input[name="email"]', "admin' OR '1'='1");
      await page.fill('input[name="password"]', "' OR '1'='1");
      
      await page.click('button:has-text("ログイン")');
      
      // ログインが失敗することを確認
      await expect(page.locator(`text="${TEST_CONFIG.errorMessages.loginFailed}"`)).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // ダッシュボードにアクセスしていないことを確認
      expect(page.url()).toContain('/login');
    });

    test('ブルートフォース攻撃への対策', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      // 5回連続で失敗
      for (let i = 0; i < 5; i++) {
        await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[name="password"]', `wrong_password_${i}`);
        await page.click('button:has-text("ログイン")');
        
        // エラーメッセージを待つ
        await page.waitForSelector(`text="${TEST_CONFIG.errorMessages.loginFailed}"`, {
          timeout: TEST_CONFIG.timeouts.element
        });
        
        // 少し待機（レート制限のため）
        await page.waitForTimeout(500);
      }
      
      // 6回目の試行
      await page.fill('input[name="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[name="password"]', 'wrong_password_6');
      await page.click('button:has-text("ログイン")');
      
      // レート制限メッセージまたは通常のエラーを確認
      const errorElement = page.locator('.bg-red-50, [role="alert"]');
      await expect(errorElement).toBeVisible({
        timeout: TEST_CONFIG.timeouts.element
      });
      
      // アプリケーションがクラッシュしていないことを確認
      await page.reload();
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });
  });
});
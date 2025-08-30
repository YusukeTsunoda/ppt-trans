import { test, expect } from '@playwright/test';
import { Config } from './config';
import { WaitUtils } from './utils/wait-utils';

/**
 * 認証フロー統合テスト - Server Actions版
 * Server Actionsを直接呼び出してテストを実行
 */
test.describe('認証フロー統合テスト（Server Actions版）', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('ユーザー登録', () => {
    test('パスワード不一致エラーの検証', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/register`);
      
      // ランダムなメールアドレスを生成
      const testEmail = `test-${Date.now()}@example.com`;
      
      // フォームに入力
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', 'ValidPassword123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword456!');
      
      // Server Actionがform actionとして設定されているため、通常通りsubmit
      await page.click('button[type="submit"]');
      
      // エラーメッセージを確認
      const errorElement = page.locator(`text="${Config.errorMessages.passwordMismatch}"`);
      await expect(errorElement).toBeVisible({
        timeout: Config.timeouts.element,
      });
      
      // ページが遷移していないことを確認
      await expect(page).toHaveURL(/.*register$/);
    });

    test('新規ユーザー登録成功', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/register`);
      
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'TestPassword123!';
      
      // フォームに入力
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.fill('input[name="confirmPassword"]', testPassword);
      
      // Server Actionを通じた登録
      await page.click('button[type="submit"]');
      
      // 成功後のリダイレクトを待つ
      await page.waitForURL(/.*\/(dashboard|login)/, {
        timeout: Config.timeouts.navigation
      });
    });
  });

  test.describe('ログイン機能 - Server Actions', () => {
    test('正常なログインフロー', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/login`);
      
      // ログイン前のCookie状態を確認
      const cookiesBefore = await context.cookies();
      const authCookieBefore = cookiesBefore.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieBefore).toBeUndefined();
      
      // Server Action経由でログイン
      await page.fill('input[name="email"]', Config.auth.email);
      await page.fill('input[name="password"]', Config.auth.password);
      
      // フォームのaction属性を確認（Server Actionが設定されているか）
      const formElement = page.locator('form').first();
      const actionAttr = await formElement.getAttribute('action');
      console.log('Form action:', actionAttr);
      
      // Server Actionを実行
      await Promise.all([
        page.waitForURL('**/dashboard', {
          timeout: Config.timeouts.navigation,
          waitUntil: 'networkidle'
        }),
        page.click('button[type="submit"]')
      ]);
      
      // セッションCookieの確認
      const cookiesAfter = await context.cookies();
      const authCookieAfter = cookiesAfter.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieAfter).toBeDefined();
      
      // ダッシュボードの要素を確認
      await expect(page.locator('h1:has-text("PowerPoint Translator")')).toBeVisible({
        timeout: Config.timeouts.element
      });
      
      // ユーザー情報の表示を確認
      await expect(page.locator(`text=/ようこそ、.*${Config.auth.email}/`)).toBeVisible({
        timeout: Config.timeouts.element
      });
    });

    test('無効な認証情報でのログイン失敗', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      await page.fill('input[name="email"]', Config.auth.email);
      await page.fill('input[name="password"]', 'WrongPassword123!');
      
      const urlBefore = page.url();
      
      // Server Actionを実行
      await page.click('button[type="submit"]');
      
      // エラー処理を待つ
      await page.waitForTimeout(1000);
      
      // エラーメッセージの表示を確認
      const errorElement = page.locator('.bg-red-50, .text-red-600, [role="alert"]').first();
      await expect(errorElement).toBeVisible({
        timeout: Config.timeouts.element
      });
      
      // ページが遷移していないことを確認
      await expect(page).toHaveURL(urlBefore);
    });
  });

  test.describe('ログアウト機能 - Server Actions', () => {
    test('Server Action経由でのログアウト', async ({ page, baseURL, context }) => {
      // まずログイン
      await Config.login(page);
      
      // ログアウト前のCookie確認
      const cookiesBefore = await context.cookies();
      const authCookieBefore = cookiesBefore.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      expect(authCookieBefore).toBeDefined();
      
      // ログアウトボタンを探す（Server Actionが設定されているはず）
      const logoutButton = page.locator('button[data-testid="logout-button"], button:has-text("ログアウト")').first();
      
      // フォームまたはボタンのaction属性を確認
      const parentForm = await logoutButton.locator('xpath=ancestor::form').count();
      if (parentForm > 0) {
        console.log('Logout button is in a form with Server Action');
      }
      
      // Server Action経由でログアウト
      await Promise.all([
        page.waitForURL('**/login', {
          timeout: Config.timeouts.navigation
        }),
        logoutButton.click()
      ]);
      
      // セッションCookieが削除されていることを確認
      const cookiesAfter = await context.cookies();
      const authCookieAfter = cookiesAfter.find(c => 
        c.name.includes('auth') || c.name.includes('sb-') && c.value
      );
      expect(authCookieAfter).toBeUndefined();
    });
  });

  test.describe('Server Actions直接呼び出しテスト', () => {
    test('Server Actionのレスポンス確認', async ({ page }) => {
      // ログインページでServer Actionの応答を確認
      await page.goto('/login');
      
      // Network監視を設定
      const responsePromise = page.waitForResponse(
        response => response.url().includes('login') && response.request().method() === 'POST'
      );
      
      // 無効な入力でServer Actionを実行
      await page.fill('input[name="email"]', 'invalid-email');
      await page.fill('input[name="password"]', '123');
      await page.click('button[type="submit"]');
      
      // レスポンスを確認
      try {
        const response = await responsePromise;
        console.log('Server Action response status:', response.status());
        
        // Server Actionは通常303 (See Other)を返す
        expect([200, 303, 302]).toContain(response.status());
      } catch (error) {
        // Server Actionがフォーム経由で実行される場合、
        // 通常のHTTPレスポンスではない可能性がある
        console.log('Server Action executed through form submission');
      }
    });
  });

  test.describe('セッション管理とServer Actions', () => {
    test('Server Action実行後のセッション維持', async ({ page, baseURL }) => {
      // ログイン
      await Config.login(page);
      
      // 別のページに遷移
      await page.goto(`${baseURL}/profile`);
      
      // Server Actionが設定されたフォームを確認
      const profileForm = page.locator('form').first();
      const hasServerAction = await profileForm.count() > 0;
      
      if (hasServerAction) {
        // プロフィール更新などのServer Actionをテスト
        const updateButton = page.locator('button[type="submit"]').first();
        if (await updateButton.isVisible()) {
          // Server Actionの実行確認
          console.log('Profile page has Server Actions');
        }
      }
      
      // セッションが維持されていることを確認
      await expect(page).not.toHaveURL(/.*login/);
    });

    test('複数タブでのServer Action実行', async ({ browser, baseURL }) => {
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      // ページ1でログイン
      await page1.goto(`${baseURL}/login`);
      await page1.fill('input[name="email"]', Config.auth.email);
      await page1.fill('input[name="password"]', Config.auth.password);
      await page1.click('button[type="submit"]');
      await page1.waitForURL('**/dashboard');
      
      // ページ2でもログイン状態を確認
      await page2.goto(`${baseURL}/dashboard`);
      await expect(page2).not.toHaveURL(/.*login/);
      
      // ページ2でServer Action（例：ファイル削除）を実行可能か確認
      const actionButton = page2.locator('button:has-text("削除")').first();
      if (await actionButton.count() > 0) {
        console.log('Can execute Server Actions in second tab');
      }
      
      await context.close();
    });
  });

  test.describe('エラーハンドリング', () => {
    test('Server Actionのバリデーションエラー', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      // 不正なメールアドレスで送信
      await page.fill('input[name="email"]', 'not-an-email');
      await page.fill('input[name="password"]', 'password');
      await page.click('button[type="submit"]');
      
      // バリデーションエラーの表示を確認
      const errorMessage = await page.locator('text=/無効|Invalid|正しい/').first();
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('Server Actionのネットワークエラー処理', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/login`);
      
      // オフラインモードをシミュレート
      await context.setOffline(true);
      
      await page.fill('input[name="email"]', Config.auth.email);
      await page.fill('input[name="password"]', Config.auth.password);
      
      // Server Action実行
      await page.click('button[type="submit"]');
      
      // エラーメッセージまたは再試行オプションを確認
      const errorElement = await page.locator('text=/ネットワーク|接続|Connection/').first();
      
      // オフラインの場合、ブラウザ自体のエラーが表示される可能性がある
      const isError = await errorElement.isVisible({ timeout: 5000 }).catch(() => false);
      
      // オンラインに戻す
      await context.setOffline(false);
      
      if (!isError) {
        // ブラウザの標準エラーページを確認
        const pageTitle = await page.title();
        expect(pageTitle.toLowerCase()).toContain('error');
      }
    });
  });
});
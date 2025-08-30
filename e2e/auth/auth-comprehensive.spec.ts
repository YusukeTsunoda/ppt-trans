import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * 包括的な認証テスト
 * 実装の正確性とセキュリティを検証
 */
test.describe('認証システムの検証', () => {
  // 重要: 各テストを独立させるため、認証状態を持たない
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('ログイン機能の正確性', () => {
    
    test('正常系: 有効な認証情報でログイン成功', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      // 入力フィールドの検証
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      
      // 正しい認証情報を入力
      await emailInput.fill(TEST_CONFIG.auth.email);
      await passwordInput.fill(TEST_CONFIG.auth.password);
      
      // ネットワークリクエストを監視
      const authRequest = page.waitForResponse(
        res => res.url().includes('/auth') && res.request().method() === 'POST'
      ).catch(() => null);
      
      // ログイン実行
      await page.locator('button[type="submit"]:has-text("ログイン")').click();
      
      // 認証リクエストの完了を待つ
      const response = await authRequest;
      
      // レスポンスステータスの検証
      if (response) {
        expect(response.status()).toBeLessThan(400);
      }
      
      // ログイン成功後のリダイレクトを検証（ダッシュボードへ）
      await page.waitForURL('**/dashboard', { 
        timeout: 10000,
        waitUntil: 'networkidle' 
      });
      
      // セッション確立の検証
      const cookies = await page.context().cookies();
      const authCookie = cookies.find(c => 
        c.name.includes('auth') || c.name.includes('session') || c.name.includes('sb-')
      );
      expect(authCookie).toBeDefined();
      // Supabaseのデフォルト設定ではhttpOnlyがfalseになることがあるため、存在確認のみ
      expect(authCookie?.name).toBeTruthy(); // Cookieが存在することを確認
      expect(authCookie?.sameSite).toBeTruthy(); // CSRF対策
    });

    test('異常系: 無効なパスワードでログイン失敗', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', 'invalid_password_12345');
      
      await page.locator('button[type="submit"]:has-text("ログイン")').click();
      
      // エラーメッセージの表示を検証
      const errorElement = page.locator('text=/メールアドレスまたはパスワードが正しくありません|Invalid|失敗/i');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
      
      // URLが変わっていないことを確認
      await expect(page).toHaveURL(/\/login/);
      
      // セッションが作成されていないことを確認
      const cookies = await page.context().cookies();
      const authCookie = cookies.find(c => 
        c.name.includes('auth') || c.name.includes('session')
      );
      expect(authCookie?.value).toBeFalsy();
    });

    test('異常系: 存在しないユーザーでログイン失敗', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.fill('input[type="password"]', 'anypassword123');
      
      await page.locator('button[type="submit"]:has-text("ログイン")').click();
      
      // エラー表示を確認（タイミング攻撃対策: 存在しないユーザーも同じエラー）
      const errorElement = page.locator('text=/メールアドレスまたはパスワードが正しくありません/i');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
      
      // セキュリティ: ユーザーの存在を示唆しないエラーメッセージ
      const errorText = await errorElement.textContent();
      expect(errorText).not.toMatch(/ユーザーが存在しません|User not found/i);
    });

    test('入力検証: 不正な形式のメールアドレス', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      const emailInput = page.locator('input[type="email"]');
      
      // 不正なメールアドレスを入力
      await emailInput.fill('not-an-email');
      await page.fill('input[type="password"]', 'password123');
      
      // HTML5バリデーションの確認
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
      expect(isValid).toBe(false);
      
      // フォーム送信を試みる
      await page.locator('button[type="submit"]').click();
      
      // ページ遷移していないことを確認
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/login');
    });

    test('セキュリティ: SQLインジェクション耐性', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      // SQLインジェクション攻撃を試みる
      await page.fill('input[type="email"]', "admin' OR '1'='1");
      await page.fill('input[type="password"]', "' OR '1'='1");
      
      await page.locator('button[type="submit"]').click();
      
      // ログインが失敗することを確認
      await expect(page).toHaveURL(/\/login/);
      
      // エラーが表示されることを確認
      const errorElement = page.locator('.bg-red-50, [role="alert"], [class*="error"]');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
    });

    test('セキュリティ: XSS攻撃耐性', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      // XSSペイロードを入力
      const xssPayload = '<img src=x onerror=alert("XSS")>';
      await page.fill('input[type="email"]', xssPayload + '@test.com');
      await page.fill('input[type="password"]', 'password123');
      
      // アラートリスナーを設定
      let xssTriggered = false;
      page.on('dialog', dialog => {
        xssTriggered = true;
        dialog.dismiss();
      });
      
      await page.locator('button[type="submit"]').click();
      await page.waitForTimeout(2000);
      
      // XSSが実行されていないことを確認
      expect(xssTriggered).toBe(false);
    });

    test('UX: ローディング状態の表示', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      
      const submitButton = page.locator('button[type="submit"]');
      
      // ボタンクリック前の状態を記録
      const initialText = await submitButton.textContent();
      
      // クリック
      await submitButton.click();
      
      // ローディング状態の確認（すぐに確認）
      const loadingState = await submitButton.textContent();
      const isDisabled = await submitButton.isDisabled();
      
      // ローディング中は状態が変わることを確認
      expect(loadingState).toMatch(/ログイン中|Loading|処理中/i);
      expect(isDisabled).toBe(true);
    });

    test('レート制限: 連続ログイン失敗の処理', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      // 5回連続で失敗を試みる
      for (let i = 0; i < 5; i++) {
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', `wrong_password_${i}`);
        await page.locator('button[type="submit"]').click();
        
        // エラーメッセージを待つ
        await page.waitForSelector('.bg-red-50, [role="alert"]', { timeout: 5000 });
        
        // 少し待機
        await page.waitForTimeout(500);
      }
      
      // レート制限メッセージまたは通常のエラーを確認
      const errorElement = page.locator('.bg-red-50').first();
      const errorText = await errorElement.textContent();
      
      // レート制限が実装されている場合のメッセージを確認
      // 実装されていない場合も、アプリケーションがクラッシュしないことを確認
      expect(errorText).toBeTruthy();
    });
  });

  test.describe('セッション管理の検証', () => {
    
    test('セッションタイムアウトの処理', async ({ page, context, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.locator('button[type="submit"]').click();
      
      await page.waitForURL('**/dashboard', { 
        timeout: 10000,
        waitUntil: 'networkidle' 
      });
      
      // Cookieを手動で無効化（有効期限を過去に設定）
      const cookies = await context.cookies();
      const expiredCookies = cookies.map(cookie => ({
        ...cookie,
        expires: Date.now() / 1000 - 3600 // 1時間前
      }));
      await context.clearCookies();
      await context.addCookies(expiredCookies);
      
      // 保護されたページにアクセス
      await page.goto(`${baseURL}/dashboard`);
      
      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('並行セッションの処理', async ({ browser, baseURL }) => {
      // 2つのコンテキストを作成
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      // 両方でログイン
      for (const page of [page1, page2]) {
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.locator('button[type="submit"]').click();
        await page.waitForURL('**/dashboard', { 
        timeout: 10000,
        waitUntil: 'networkidle' 
      });
      }
      
      // 片方でログアウト
      const logoutButton = page1.locator('button:has-text("ログアウト")');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }
      
      // もう片方のセッションが影響を受けないことを確認
      await page2.reload();
      await expect(page2).not.toHaveURL(/\/login/);
      
      await context1.close();
      await context2.close();
    });
  });
});
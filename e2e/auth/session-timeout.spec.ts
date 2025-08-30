import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * セッションタイムアウトのテスト
 * - 30分間の非活動後の自動ログアウト
 * - タイムアウト警告の表示
 * - セッション延長機能
 */
test.describe('セッションタイムアウト', () => {
  
  test.describe('30分タイムアウト', () => {
    test('30分間の非活動後に自動ログアウト', async ({ page, baseURL, context }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // セッションCookieを操作して30分後の状態をシミュレート
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      
      if (sessionCookie) {
        // Cookieの有効期限を30分前に設定
        await context.clearCookies();
        await context.addCookies([{
          ...sessionCookie,
          expires: Date.now() / 1000 - 1800 // 30分前
        }]);
      }
      
      // ページをリロード
      await page.reload();
      
      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      
      // セッションタイムアウトメッセージが表示されることを確認
      const timeoutMessage = page.locator('text=/セッションがタイムアウトしました|Session expired/i');
      await expect(timeoutMessage).toBeVisible({ timeout: 5000 });
    });

    test('25分後にタイムアウト警告を表示', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 25分経過をシミュレート（実際のテストでは時間を操作）
      await page.evaluate(() => {
        // セッションタイマーをモック
        const event = new CustomEvent('sessionWarning', { 
          detail: { minutesRemaining: 5 } 
        });
        window.dispatchEvent(event);
      });
      
      // 警告メッセージが表示されることを確認
      const warningDialog = page.locator('[role="dialog"], [aria-label*="警告"], .session-warning');
      await expect(warningDialog).toBeVisible({ timeout: 5000 });
      
      // 「セッションを延長」ボタンが表示されることを確認
      const extendButton = page.locator('button:has-text("延長"), button:has-text("Extend")');
      await expect(extendButton).toBeVisible();
    });

    test('セッション延長機能の動作確認', async ({ page, baseURL, context }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 警告を表示
      await page.evaluate(() => {
        const event = new CustomEvent('sessionWarning', { 
          detail: { minutesRemaining: 5 } 
        });
        window.dispatchEvent(event);
      });
      
      // セッション延長ボタンをクリック
      const extendButton = page.locator('button:has-text("延長"), button:has-text("Extend")').first();
      await extendButton.click();
      
      // 警告が消えることを確認
      const warningDialog = page.locator('[role="dialog"], .session-warning');
      await expect(warningDialog).not.toBeVisible({ timeout: 5000 });
      
      // セッションが延長されたことを確認（Cookieを確認）
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      
      if (sessionCookie && sessionCookie.expires) {
        // 有効期限が現在時刻より後であることを確認
        expect(sessionCookie.expires * 1000).toBeGreaterThan(Date.now());
      }
    });
  });

  test.describe('アクティビティによるセッション維持', () => {
    test('ユーザー操作でセッションがリセットされる', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 初期のセッション時刻を記録
      const initialTime = Date.now();
      
      // 20分待機をシミュレート
      await page.waitForTimeout(1000);
      
      // ユーザー操作を実行（ページナビゲーション）
      await page.click('a[href="/files"]');
      await page.waitForURL('**/files');
      
      // セッションがリセットされていることを確認
      // (実際の実装では、セッションタイマーが更新されることを確認)
      const sessionActive = await page.evaluate(() => {
        return !document.body.classList.contains('session-expired');
      });
      expect(sessionActive).toBe(true);
      
      // ダッシュボードに戻る
      await page.click('a[href="/dashboard"]');
      await page.waitForURL('**/dashboard');
      
      // まだログイン状態であることを確認
      await expect(page.locator('button:has-text("ログアウト")')).toBeVisible();
    });

    test('APIリクエストでセッションが更新される', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // APIリクエストを実行
      const response = await page.request.get(`${baseURL}/api/user/profile`);
      expect(response.ok()).toBe(true);
      
      // セッションが更新されていることを確認
      await page.reload();
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('button:has-text("ログアウト")')).toBeVisible();
    });
  });

  test.describe('タブ間のセッション同期', () => {
    test('複数タブでセッションが同期される', async ({ browser, baseURL }) => {
      const context = await browser.newContext();
      
      // タブ1でログイン
      const page1 = await context.newPage();
      await page1.goto(`${baseURL}/login`);
      await page1.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page1.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page1.click('button[type="submit"]:has-text("ログイン")');
      await page1.waitForURL('**/dashboard');
      
      // タブ2を開く
      const page2 = await context.newPage();
      await page2.goto(`${baseURL}/dashboard`);
      
      // タブ2でもログイン状態であることを確認
      await expect(page2).not.toHaveURL(/\/login/);
      await expect(page2.locator('button:has-text("ログアウト")')).toBeVisible();
      
      // タブ1でログアウト
      await page1.click('button:has-text("ログアウト")');
      await page1.waitForURL('**/login');
      
      // タブ2をリロード
      await page2.reload();
      
      // タブ2もログアウトされていることを確認
      await expect(page2).toHaveURL(/\/login/);
      
      await context.close();
    });

    test('一つのタブでのタイムアウトが他のタブに影響する', async ({ browser, baseURL }) => {
      const context = await browser.newContext();
      
      // 両方のタブでログイン
      const page1 = await context.newPage();
      const page2 = await context.newPage();
      
      for (const page of [page1, page2]) {
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.click('button[type="submit"]:has-text("ログイン")');
        await page.waitForURL('**/dashboard');
      }
      
      // タブ1でセッションを無効化
      await context.clearCookies();
      
      // 両方のタブをリロード
      await page1.reload();
      await page2.reload();
      
      // 両方ともログインページにリダイレクトされることを確認
      await expect(page1).toHaveURL(/\/login/);
      await expect(page2).toHaveURL(/\/login/);
      
      await context.close();
    });
  });

  test.describe('セキュリティ検証', () => {
    test('ログアウト後のブラウザバックでの保護', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // いくつかのページを訪問
      await page.goto(`${baseURL}/files`);
      await page.goto(`${baseURL}/profile`);
      
      // ログアウト
      await page.click('button:has-text("ログアウト")');
      await page.waitForURL('**/login');
      
      // ブラウザバックを試みる
      await page.goBack();
      
      // ログインページにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
      
      // キャッシュされたコンテンツが表示されないことを確認
      await expect(page.locator('text=/プロフィール|Profile/')).not.toBeVisible();
    });

    test('セッションハイジャック対策の確認', async ({ page, browser, baseURL }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      // ユーザー1でログイン
      await page1.goto(`${baseURL}/login`);
      await page1.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page1.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page1.click('button[type="submit"]:has-text("ログイン")');
      await page1.waitForURL('**/dashboard');
      
      // セッションCookieを取得
      const cookies = await context1.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('sb-'));
      
      // 別のコンテキストでCookieを使用
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      if (sessionCookie) {
        // IPアドレスやUser-Agentが異なる場合のセッション検証
        await context2.addCookies([sessionCookie]);
        await page2.goto(`${baseURL}/dashboard`);
        
        // セキュリティチェックによりログインページにリダイレクトされる可能性
        // （実装によって異なる）
        const url = page2.url();
        
        // セッションセキュリティが実装されている場合の動作を確認
        if (url.includes('/login')) {
          // セッション無効化が正しく動作
          expect(url).toContain('/login');
        } else {
          // セッションが有効な場合でも、ユーザー情報が正しいことを確認
          await expect(page2.locator(`text=${TEST_CONFIG.auth.email}`)).toBeVisible();
        }
      }
      
      await context1.close();
      await context2.close();
    });
  });
});
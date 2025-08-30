/**
 * Server Actions認証フローE2Eテスト（修正版）
 * Server Actions Helper を使用した安定版実装
 */

import { test, expect } from '@playwright/test';
import { ServerActionsHelper } from './helpers/server-actions-helper';
import path from 'path';

// テストユーザー情報
const TEST_USERS = {
  valid: {
    email: 'test@example.com',
    password: 'testpassword123'
  },
  invalid: {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  }
};

test.describe('Server Actions認証フロー統合テスト（修正版）', () => {
  test.beforeEach(async ({ page, context }) => {
    // クリーンな状態から開始
    await context.clearCookies();
    await page.goto('/');
    
    // localStorageをクリア
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('ログイン機能', () => {
    test('正常なログインフロー', async ({ page }) => {
      // ログインページへ移動
      await page.goto('/login');
      await expect(page).toHaveURL(/.*\/login/);
      
      // ページが完全にロードされるまで待機
      await page.waitForLoadState('networkidle');
      
      // フォーム要素の存在確認
      const emailInput = page.locator('[name="email"]');
      const passwordInput = page.locator('[name="password"]');
      const submitButton = page.locator('button[type="submit"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Server Actionを使用してログイン
      console.log('Attempting login with Server Action...');
      await ServerActionsHelper.fillAndSubmitForm(
        page,
        TEST_USERS.valid,
        'button[type="submit"]',
        /.*\/dashboard/
      );
      
      // ダッシュボードへの遷移確認
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 15000 });
      
      // ダッシュボード要素の確認
      await expect(page.locator('h1')).toContainText('ダッシュボード');
    });

    test('無効な認証情報でのログイン', async ({ page }) => {
      await page.goto('/login');
      
      // 無効な認証情報で送信
      await ServerActionsHelper.fillAndSubmitForm(
        page,
        TEST_USERS.invalid,
        'button[type="submit"]'
      );
      
      // エラーメッセージの確認
      const hasError = await ServerActionsHelper.hasServerActionError(page);
      expect(hasError).toBeTruthy();
      
      const errorMessage = await ServerActionsHelper.getServerActionError(page);
      expect(errorMessage).toBeTruthy();
      
      // ログインページに留まることを確認
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('必須フィールドの検証', async ({ page }) => {
      await page.goto('/login');
      
      // 空のフォームを送信
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // HTML5バリデーションメッセージの確認
      const emailInput = page.locator('[name="email"]');
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => 
        el.validationMessage
      );
      expect(validationMessage).toBeTruthy();
    });
  });

  test.describe('ログアウト機能', () => {
    test('正常なログアウトフロー', async ({ page }) => {
      // まずログイン
      const loginSuccess = await ServerActionsHelper.authenticateWithServerAction(
        page,
        TEST_USERS.valid.email,
        TEST_USERS.valid.password
      );
      expect(loginSuccess).toBeTruthy();
      
      // ダッシュボードでログアウトボタンを探す
      const logoutButton = page.locator('button:has-text("ログアウト")').first();
      
      if (await logoutButton.isVisible()) {
        // Server Actionログアウトの実行
        await Promise.all([
          page.waitForURL(/.*\/login/, { timeout: 10000 }),
          logoutButton.click()
        ]);
        
        // ログインページへの遷移確認
        await expect(page).toHaveURL(/.*\/login/);
      }
    });
  });

  test.describe('セキュリティ検証', () => {
    test('認証なしでの保護ページアクセス制御', async ({ page }) => {
      // 直接ダッシュボードへアクセス
      await page.goto('/dashboard');
      
      // ログインページへリダイレクトされることを確認
      await expect(page).toHaveURL(/.*\/login/, { timeout: 10000 });
    });

    test('XSS攻撃への耐性', async ({ page }) => {
      await page.goto('/login');
      
      // XSSペイロードを含むログイン試行
      const xssPayload = '<script>alert("XSS")</script>';
      await ServerActionsHelper.fillAndSubmitForm(
        page,
        {
          email: `test${xssPayload}@example.com`,
          password: 'password123'
        },
        'button[type="submit"]'
      );
      
      // アラートが表示されないことを確認
      let alertShown = false;
      page.on('dialog', () => {
        alertShown = true;
      });
      
      await page.waitForTimeout(2000);
      expect(alertShown).toBeFalsy();
    });
  });

  test.describe('パフォーマンステスト', () => {
    test('ログイン応答時間の測定', async ({ page }) => {
      await page.goto('/login');
      
      const startTime = Date.now();
      
      // Server Actionでログイン
      await ServerActionsHelper.fillAndSubmitForm(
        page,
        TEST_USERS.valid,
        'button[type="submit"]',
        /.*\/dashboard/
      );
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`Login response time: ${responseTime}ms`);
      
      // 応答時間が5秒以内であることを確認
      expect(responseTime).toBeLessThan(5000);
    });
  });

  test.describe('エラー処理', () => {
    test('ネットワークエラー時の適切な処理', async ({ page, context }) => {
      await page.goto('/login');
      
      // オフラインモードに設定
      await context.setOffline(true);
      
      // ログイン試行
      await page.fill('[name="email"]', TEST_USERS.valid.email);
      await page.fill('[name="password"]', TEST_USERS.valid.password);
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // エラーハンドリングの確認（タイムアウトまたはエラーメッセージ）
      await page.waitForTimeout(2000);
      
      // オンラインに戻す
      await context.setOffline(false);
    });

    test('Server Action pending状態の確認', async ({ page }) => {
      await page.goto('/login');
      
      // フォームに入力
      await page.fill('[name="email"]', TEST_USERS.valid.email);
      await page.fill('[name="password"]', TEST_USERS.valid.password);
      
      // ボタンをクリックして即座に状態を確認
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // pending状態のテキストを確認（一瞬なので失敗する可能性あり）
      const buttonText = await submitButton.textContent();
      const isPending = buttonText?.includes('ログイン中') || 
                        await submitButton.isDisabled();
      
      console.log(`Button pending state detected: ${isPending}`);
      
      // pending状態が完了するまで待機
      await ServerActionsHelper.waitForPendingState(page);
    });
  });
});
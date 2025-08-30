/**
 * 安定版認証フローE2Eテスト
 * API Routes + fetchパターンを使用
 */

import { test, expect } from '@playwright/test';

test.describe('認証フロー（安定版API Routes）', () => {
  test.beforeEach(async ({ page }) => {
    // クリーンな状態から開始
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('API Route経由のログインフロー', async ({ page }) => {
    // 1. ログインページへ移動
    await page.goto('/login');
    await expect(page).toHaveURL(/.*\/login/);
    
    // 2. フォーム要素の存在確認
    const emailInput = page.locator('[name="email"]');
    const passwordInput = page.locator('[name="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    
    // 3. APIレスポンスを監視
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login') && response.status() === 200,
      { timeout: 10000 }
    );
    
    // 4. フォーム入力
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword123');
    
    // 5. フォーム送信
    await submitButton.click();
    
    // 6. APIレスポンスを待つ
    const response = await responsePromise;
    const responseData = await response.json();
    
    // 7. レスポンス検証
    expect(response.status()).toBe(200);
    expect(responseData.success).toBeTruthy();
    expect(responseData.user).toBeDefined();
    expect(responseData.redirectTo).toBe('/dashboard');
    
    // 8. ダッシュボードへの遷移を確認
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('無効な認証情報でのエラーハンドリング', async ({ page }) => {
    await page.goto('/login');
    
    // APIエラーレスポンスを監視
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 10000 }
    );
    
    // 無効な認証情報を入力
    await page.fill('[name="email"]', 'invalid@example.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.locator('button[type="submit"]').click();
    
    // エラーレスポンスを確認
    const response = await responsePromise;
    const responseData = await response.json();
    
    expect(response.status()).toBe(401);
    expect(responseData.success).toBeFalsy();
    expect(responseData.code).toBe('AUTH_FAILED');
    
    // エラーメッセージの表示を確認
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('メールアドレスまたはパスワードが正しくありません');
    
    // ログインページに留まることを確認
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('入力検証エラー', async ({ page }) => {
    await page.goto('/login');
    
    // 短すぎるパスワードでテスト
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 10000 }
    );
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', '12345'); // 6文字未満
    await page.locator('button[type="submit"]').click();
    
    const response = await responsePromise;
    const responseData = await response.json();
    
    expect(response.status()).toBe(400);
    expect(responseData.code).toBe('VALIDATION_ERROR');
    
    // バリデーションエラーメッセージの表示
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('ローディング状態の確認', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword123');
    
    const submitButton = page.locator('button[type="submit"]');
    
    // クリック前の状態
    await expect(submitButton).toContainText('ログイン');
    await expect(submitButton).not.toBeDisabled();
    
    // クリック直後の状態を確認
    await submitButton.click();
    
    // ローディング中の状態
    await expect(submitButton).toContainText('ログイン中...');
    await expect(submitButton).toBeDisabled();
    
    // APIレスポンスを待つ
    await page.waitForResponse(
      response => response.url().includes('/api/auth/login'),
      { timeout: 10000 }
    );
  });

  test('ネットワークエラー時の処理', async ({ page, context }) => {
    await page.goto('/login');
    
    // ネットワークをオフラインに設定
    await context.setOffline(true);
    
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword123');
    await page.locator('button[type="submit"]').click();
    
    // エラーメッセージの表示を待つ
    await page.waitForTimeout(2000);
    
    // エラーメッセージが表示されることを確認
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();
    
    // ネットワークを復旧
    await context.setOffline(false);
  });

  test('フォームのアクセシビリティ', async ({ page }) => {
    await page.goto('/login');
    
    // ARIA属性の確認
    const emailInput = page.locator('[name="email"]');
    const passwordInput = page.locator('[name="password"]');
    const submitButton = page.locator('button[type="submit"]');
    
    // aria-labelの確認
    await expect(emailInput).toHaveAttribute('aria-label', 'メールアドレス');
    await expect(passwordInput).toHaveAttribute('aria-label', 'パスワード');
    
    // aria-requiredの確認
    await expect(emailInput).toHaveAttribute('aria-required', 'true');
    await expect(passwordInput).toHaveAttribute('aria-required', 'true');
    
    // ローディング中のaria-busy属性
    await emailInput.fill('test@example.com');
    await passwordInput.fill('testpassword123');
    await submitButton.click();
    
    await expect(submitButton).toHaveAttribute('aria-busy', 'true');
  });
});
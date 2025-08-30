/**
 * 認証フローのCoreテスト
 * ログイン、ログアウト、セッション管理の基本動作を検証
 */

import { test, expect } from '../../fixtures/auth';
import { Config } from '../../config';

test.describe('認証フロー - ログイン', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(Config.urls.login);
  });

  test('正常なログイン', async ({ page }) => {
    // ログインフォームの表示確認
    await expect(page.locator(Config.selectors.auth.emailInput)).toBeVisible();
    await expect(page.locator(Config.selectors.auth.passwordInput)).toBeVisible();
    
    // ログイン実行
    await page.fill(Config.selectors.auth.emailInput, Config.auth.email);
    await page.fill(Config.selectors.auth.passwordInput, Config.auth.password);
    await page.click(Config.selectors.auth.submitButton);
    
    // ダッシュボードへの遷移確認
    await expect(page).toHaveURL(/.*\/dashboard/, { 
      timeout: Config.timeouts.navigation 
    });
    
    // ユーザー情報の表示確認
    await expect(page.locator(`text=/ようこそ、.*${Config.auth.email}/`)).toBeVisible({
      timeout: Config.timeouts.element
    });
  });

  test('無効な認証情報でのログイン失敗', async ({ page }) => {
    // 無効な認証情報を入力
    await page.fill(Config.selectors.auth.emailInput, 'invalid@example.com');
    await page.fill(Config.selectors.auth.passwordInput, 'wrongpassword');
    await page.click(Config.selectors.auth.submitButton);
    
    // エラーメッセージの表示確認
    const errorMessage = await Config.getErrorMessage(page);
    expect(errorMessage).toBeTruthy();
    
    // ログインページに留まることを確認
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('必須フィールドのバリデーション', async ({ page }) => {
    // 空のフォームで送信
    await page.click(Config.selectors.auth.submitButton);
    
    // HTML5バリデーションメッセージを確認
    const emailInput = page.locator(Config.selectors.auth.emailInput);
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => 
      el.validationMessage
    );
    expect(validationMessage).toBeTruthy();
  });

  test('メールアドレス形式のバリデーション', async ({ page }) => {
    // 無効なメールアドレス形式を入力
    await page.fill(Config.selectors.auth.emailInput, 'notanemail');
    await page.fill(Config.selectors.auth.passwordInput, 'password123');
    await page.click(Config.selectors.auth.submitButton);
    
    // バリデーションエラーを確認
    const emailInput = page.locator(Config.selectors.auth.emailInput);
    const validity = await emailInput.evaluate((el: HTMLInputElement) => 
      el.validity.typeMismatch
    );
    expect(validity).toBe(true);
  });
});

test.describe('認証フロー - ログアウト', () => {
  test('正常なログアウト', async ({ authenticatedPage }) => {
    // 認証済みページからログアウト
    await Config.logout(authenticatedPage);
    
    // ログインページへの遷移確認
    await expect(authenticatedPage).toHaveURL(/.*\/login/);
    
    // セッションがクリアされていることを確認
    const cookies = await authenticatedPage.context().cookies();
    const authCookie = cookies.find(c => 
      c.name.includes('auth') || c.name.includes('sb-')
    );
    expect(authCookie).toBeUndefined();
  });

  test('ログアウト後の保護ページアクセス制限', async ({ authenticatedPage }) => {
    // ログアウト実行
    await Config.logout(authenticatedPage);
    
    // 保護ページへ直接アクセス試行
    await authenticatedPage.goto(Config.urls.dashboard);
    
    // ログインページへリダイレクトされることを確認
    await expect(authenticatedPage).toHaveURL(/.*\/login/);
  });
});

test.describe('認証フロー - セッション管理', () => {
  test('セッション維持の確認', async ({ authenticatedPage }) => {
    // ダッシュボードへアクセス
    await authenticatedPage.goto(Config.urls.dashboard);
    await expect(authenticatedPage).toHaveURL(/.*\/dashboard/);
    
    // プロフィールページへ遷移
    await authenticatedPage.goto(Config.urls.profile);
    await expect(authenticatedPage).toHaveURL(/.*\/profile/);
    
    // セッションが維持されていることを確認
    const profileLink = authenticatedPage.locator(Config.selectors.dashboard.profileLink);
    await expect(profileLink).toBeVisible();
  });

  test('複数タブでのセッション共有', async ({ authenticatedPage, context }) => {
    // 新しいタブを開く
    const newPage = await context.newPage();
    
    // 新しいタブでダッシュボードへアクセス
    await newPage.goto(Config.urls.dashboard);
    
    // 認証状態が共有されていることを確認
    await expect(newPage).toHaveURL(/.*\/dashboard/);
    
    // クリーンアップ
    await newPage.close();
  });

  test('セッションタイムアウト（スキップ: 長時間テスト）', async ({ authenticatedPage }) => {
    test.skip(true, 'Long-running test - manual execution only');
    
    // セッションタイムアウトまで待機（実装による）
    await authenticatedPage.waitForTimeout(30 * 60 * 1000); // 30分
    
    // ページリロード
    await authenticatedPage.reload();
    
    // セッションが切れていることを確認
    await expect(authenticatedPage).toHaveURL(/.*\/login/);
  });
});
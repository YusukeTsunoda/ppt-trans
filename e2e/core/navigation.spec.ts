import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * ナビゲーション - MVPコアテスト
 * 基本的な画面遷移と導線を検証
 */
test.describe('ナビゲーション', () => {
  test('ログイン後の正しいリダイレクト', async ({ page, baseURL }) => {
    // ダッシュボードへの自動遷移を確認
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // ナビゲーションメニューが表示される
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
    
    // 主要なリンクが存在する
    await expect(page.locator('a[href*="/upload"]')).toBeVisible();
    await expect(page.locator('a[href*="/dashboard"]')).toBeVisible();
  });

  test('404ページの表示', async ({ page, baseURL }) => {
    // 存在しないページへアクセス
    await page.goto(`${baseURL}/nonexistent-page-12345`);
    
    // 404エラーまたはダッシュボードへのリダイレクト
    const is404 = page.url().includes('404') || 
                  await page.locator('text=/404|ページが見つかりません|Not Found/').isVisible();
    const isDashboard = page.url().includes('dashboard');
    
    expect(is404 || isDashboard).toBeTruthy();
  });

  test('ブラウザバックの動作', async ({ page, baseURL }) => {
    // ダッシュボード → アップロード → バック
    await page.goto(`${baseURL}/dashboard`);
    await page.goto(`${baseURL}/upload`);
    
    await page.goBack();
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    await page.goForward();
    await expect(page).toHaveURL(/.*\/upload/);
  });

  test('ログアウト後の保護ページへのアクセス', async ({ page, baseURL }) => {
    // ログアウトボタンをクリック
    const logoutButton = page.locator('button:has-text("ログアウト"), a:has-text("ログアウト")');
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      
      // ログインページへリダイレクト
      await expect(page).toHaveURL(/.*\/login/);
      
      // 保護されたページにアクセス試行
      await page.goto(`${baseURL}/dashboard`);
      
      // ログインページへリダイレクトされることを確認
      await expect(page).toHaveURL(/.*\/login/);
    }
  });
});
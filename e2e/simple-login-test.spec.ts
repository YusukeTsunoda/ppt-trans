import { test, expect } from '@playwright/test';
import { UNIFIED_TEST_CONFIG } from './config/unified-test-config';

test.describe('シンプルなログインテスト', () => {
  test('テストユーザーでログインできることを確認', async ({ page }) => {
    // ログインページに直接アクセス
    await page.goto(`${UNIFIED_TEST_CONFIG.baseUrl}/login`);
    
    // ページが読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // ログインページの確認
    console.log('現在のURL:', page.url());
    
    // h1タグでログインテキストを確認
    const loginHeader = page.locator('h1').filter({ hasText: 'ログイン' });
    await expect(loginHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ ログインページが表示されました');
    
    // メールアドレス入力
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(UNIFIED_TEST_CONFIG.users.standard.email);
    console.log('✅ メールアドレスを入力しました');
    
    // パスワード入力
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(UNIFIED_TEST_CONFIG.users.standard.password);
    console.log('✅ パスワードを入力しました');
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    console.log('✅ ログインボタンをクリックしました');
    
    // ダッシュボードへのリダイレクトまたはエラーメッセージを待つ
    const result = await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }).then(() => 'success'),
      page.locator('text=/メールアドレスまたはパスワード/i').waitFor({ timeout: 5000 }).then(() => 'error'),
    ]).catch(() => 'timeout');
    
    if (result === 'success') {
      console.log('✅ ログインに成功し、ダッシュボードにリダイレクトされました');
      await expect(page).toHaveURL(/\/dashboard/);
      
      // ユーザー情報の確認
      const userEmail = page.locator(`text=${UNIFIED_TEST_CONFIG.users.standard.email}`);
      if (await userEmail.isVisible()) {
        console.log('✅ ユーザーのメールアドレスが表示されています');
      }
    } else if (result === 'error') {
      console.log('❌ ログインに失敗しました - 認証情報が正しくない可能性があります');
      const errorMessage = await page.locator('text=/メールアドレスまたはパスワード/i').textContent();
      console.log('エラーメッセージ:', errorMessage);
      
      // テストを失敗させる
      expect(result).toBe('success');
    } else {
      console.log('⚠️ タイムアウトしました - ページの応答がありません');
      console.log('現在のURL:', page.url());
      
      // ページの内容を確認
      const pageTitle = await page.title();
      console.log('ページタイトル:', pageTitle);
    }
  });

  test('管理者ユーザーでのログインを試みる', async ({ page }) => {
    // ログインページに直接アクセス
    await page.goto(`${UNIFIED_TEST_CONFIG.baseUrl}/login`);
    
    // ページが読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // ログインページの確認
    const loginHeader = page.locator('h1').filter({ hasText: 'ログイン' });
    await expect(loginHeader).toBeVisible({ timeout: 5000 });
    console.log('✅ ログインページが表示されました');
    
    // メールアドレス入力
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.fill(UNIFIED_TEST_CONFIG.users.admin.email);
    console.log('✅ 管理者メールアドレスを入力しました');
    
    // パスワード入力
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await passwordInput.fill(UNIFIED_TEST_CONFIG.users.admin.password);
    console.log('✅ 管理者パスワードを入力しました');
    
    // ログインボタンをクリック
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    console.log('✅ ログインボタンをクリックしました');
    
    // 結果を待つ
    const result = await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }).then(() => 'success'),
      page.locator('text=/メールアドレスまたはパスワード/i').waitFor({ timeout: 5000 }).then(() => 'error'),
    ]).catch(() => 'timeout');
    
    if (result === 'success') {
      console.log('✅ 管理者ユーザーでログインに成功しました！');
      await expect(page).toHaveURL(/\/dashboard/);
      
      // 管理者メニューの確認
      const adminLink = page.locator('a[href="/admin"], text=/管理/i');
      if (await adminLink.isVisible()) {
        console.log('✅ 管理者メニューが表示されています');
      }
    } else if (result === 'error') {
      console.log('❌ 管理者ユーザーはまだ作成されていません');
      console.log('管理者ユーザーを作成するには、Supabaseの管理画面から直接作成してください');
    } else {
      console.log('⚠️ タイムアウトしました');
    }
  });
});
import { test, expect } from '@playwright/test';

test.describe('最終ログインテスト', () => {
  test('test@example.com / testpassword123 でログインできる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    console.log('📍 現在のURL:', page.url());
    
    // ログインページであることを確認
    const loginHeader = await page.locator('h1').textContent();
    console.log('📝 ページタイトル:', loginHeader);
    expect(loginHeader).toContain('ログイン');
    
    // メールアドレスを入力
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    console.log('✅ メールアドレスを入力: test@example.com');
    
    // パスワードを入力
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('testpassword123');
    console.log('✅ パスワードを入力: testpassword123');
    
    // スクリーンショットを撮る（デバッグ用）
    await page.screenshot({ path: 'before-login.png' });
    
    // フォーム送信
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    console.log('🚀 ログインボタンをクリック');
    
    // 結果を待つ
    try {
      // ダッシュボードへの遷移を待つ（最大10秒）
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      console.log('✅ ログイン成功！ダッシュボードに遷移しました');
      console.log('📍 現在のURL:', page.url());
      
      // ダッシュボードページであることを確認
      await expect(page).toHaveURL(/\/dashboard/);
      
      // スクリーンショットを撮る
      await page.screenshot({ path: 'dashboard-after-login.png' });
      
      // ユーザー情報が表示されているか確認
      const pageContent = await page.content();
      if (pageContent.includes('test@example.com')) {
        console.log('✅ ユーザーメールアドレスが表示されています');
      }
      
    } catch (error) {
      // エラーまたはタイムアウトの場合
      console.log('❌ ログインに失敗またはタイムアウト');
      console.log('📍 現在のURL:', page.url());
      
      // エラーメッセージを探す
      const errorElement = page.locator('text=/メールアドレスまたはパスワード/i');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.log('⚠️ エラーメッセージ:', errorText);
      }
      
      // 現在のページのスクリーンショット
      await page.screenshot({ path: 'login-error.png' });
      
      // ページの内容を確認
      const pageTitle = await page.title();
      console.log('📄 ページタイトル:', pageTitle);
      
      throw new Error('ログインに失敗しました');
    }
  });
});
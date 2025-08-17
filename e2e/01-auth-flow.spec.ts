import { test, expect, TEST_USER } from './fixtures/test-base';

/**
 * 認証フロー統合テスト
 * auth.spec.tsの内容を統合
 */
test.describe('認証フロー統合テスト', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/`);
  });

  test.describe('ユーザー登録', () => {
    test('パスワードが一致しない場合はエラーが表示される', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/register`);
      
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      await page.click('button:has-text("新規登録")');
      
      // エラーメッセージが必須で表示される
      await expect(page.locator('text=パスワードが一致しません')).toBeVisible({
        timeout: 5000,
        message: 'パスワード不一致のエラーメッセージが表示されていません'
      });
      
      // ページ遷移しないことを確認
      await expect(page).toHaveURL(/.*register/);
    });
  });

  test.describe('ログイン・ログアウト', () => {
    test('正しい認証情報でログインしてログアウトできる', async ({ page, baseURL }) => {
      // ログインページへ移動
      await page.goto(`${baseURL}/login`);
      await page.waitForLoadState('networkidle');
      
      // ページ要素の存在を必須で確認
      await expect(page.locator('h1')).toContainText('PowerPoint Translator', { 
        timeout: 30000,
        message: 'ログインページのタイトルが表示されていません'
      });
      
      // ログイン実行
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button:has-text("ログイン")');
      
      // ダッシュボードへのリダイレクトを確認（必須）
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await expect(page.locator('text=/ようこそ.*' + TEST_USER.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/')).toBeVisible({
        timeout: 10000,
        message: 'ウェルカムメッセージが表示されていません'
      });
      
      // ログアウト実行
      await page.click('button:has-text("ログアウト")');
      
      // ログインページへのリダイレクトを確認（必須）
      await page.waitForURL('**/login', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible({
        timeout: 5000,
        message: 'ログインページに戻っていません'
      });
    });

    test('誤った認証情報ではログインできない', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', 'wrongpassword');
      
      await page.click('button:has-text("ログイン")');
      
      // エラーメッセージが必須で表示される
      await expect(page.locator('text=/メールアドレスまたはパスワードが正しくありません|Invalid login credentials|ログインに失敗しました/')).toBeVisible({
        timeout: 5000,
        message: 'ログインエラーメッセージが表示されていません'
      });
      
      // ダッシュボードには遷移しない
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('アクセス制御', () => {
    test('未認証状態で保護されたページにアクセスするとログインページにリダイレクトされる', async ({ page, baseURL }) => {
      // ダッシュボードに直接アクセス
      await page.goto(`${baseURL}/dashboard`);
      
      // ログインページへのリダイレクトを確認（必須）
      await page.waitForURL('**/login?callbackUrl=%2Fdashboard', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible({
        timeout: 5000,
        message: 'ログインページが表示されていません'
      });
      
      // アップロードページに直接アクセス
      await page.goto(`${baseURL}/upload`);
      await page.waitForURL('**/login?callbackUrl=%2Fupload', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible({
        timeout: 5000,
        message: 'ログインページが表示されていません'
      });
    });

    test('callbackUrlパラメータが保持される', async ({ page, baseURL }) => {
      // 保護されたページにアクセス
      await page.goto(`${baseURL}/dashboard`);
      await page.waitForURL('**/login?callbackUrl=%2Fdashboard');
      
      // ログイン
      await page.fill('input[name="email"]', TEST_USER.email);
      await page.fill('input[name="password"]', TEST_USER.password);
      await page.click('button:has-text("ログイン")');
      
      // 元のページ（dashboard）にリダイレクトされることを確認（必須）
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await expect(page.locator('h1')).toContainText('PowerPoint Translator', {
        timeout: 5000,
        message: 'ダッシュボードが表示されていません'
      });
    });
  });
});
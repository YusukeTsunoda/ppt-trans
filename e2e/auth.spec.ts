import { test, expect, TEST_USER } from './fixtures/test-base';

test.describe('【Critical 🔴】ユーザー認証フロー', () => {
  test.beforeEach(async ({ page }) => {
    // 各テストの前にホームページにアクセス
    await page.goto('/');
  });

  test.describe('シナリオ1: 新規ユーザー登録', () => {
    test('有効な情報で新規登録できる', async ({ page }) => {
      // GIVEN: 登録ページにアクセス
      await page.goto('/register');
      
      // ページが正しく読み込まれたことを確認
      await expect(page.locator('h1')).toContainText('PowerPoint Translator');
      await expect(page.locator('text=新規アカウント作成')).toBeVisible();
      
      // WHEN: 有効なメールアドレスとパスワードを入力して登録
      const timestamp = Date.now();
      const newUserEmail = `test.${timestamp}@example.com`;
      
      await page.fill('input[name="email"]', newUserEmail);
      await page.fill('input[name="password"]', 'ValidPassword123!');
      await page.fill('input[name="confirmPassword"]', 'ValidPassword123!');
      
      // 登録ボタンをクリック（「新規登録」というテキストのボタンを探す）
      await page.click('button:has-text("新規登録")');
      
      // THEN: ダッシュボードページにリダイレクトされる
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      
      // 「ようこそ」メッセージが表示される
      await expect(page.locator('text=/ようこそ.*' + newUserEmail + '/')).toBeVisible({ timeout: 10000 });
    });

    test('パスワードが一致しない場合はエラーが表示される', async ({ page }) => {
      await page.goto('/register');
      
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Password123!');
      await page.fill('input[name="confirmPassword"]', 'DifferentPassword123!');
      
      await page.click('button:has-text("新規登録")');
      
      // エラーメッセージが表示される
      await expect(page.locator('text=パスワードが一致しません')).toBeVisible();
      
      // ページ遷移しない
      await expect(page).toHaveURL(/.*register/);
    });
  });

  test.describe('シナリオ2: 既存ユーザーのログイン＆ログアウト', () => {
    test('正しい認証情報でログインしてログアウトできる', async ({ page }) => {
      // GIVEN: ログインページにアクセス
      await page.goto('/login');
      
      // ページが正しく読み込まれたことを確認
      await expect(page.locator('h1')).toContainText('PowerPoint Translator');
      await expect(page.locator('text=アカウントにログイン')).toBeVisible();
      
      // WHEN: 存在するユーザーの認証情報を入力してログイン
      // テストアカウントの情報を使用
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      
      await page.click('button:has-text("ログイン")');
      
      // THEN: ダッシュボードにリダイレクトされる
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await expect(page.locator('h1')).toContainText('PowerPoint Translator');
      await expect(page.locator('text=/ようこそ.*test@example.com/')).toBeVisible();
      
      // AND WHEN: ログアウトボタンを押す
      await page.click('button:has-text("ログアウト")');
      
      // THEN: ログインページに戻る
      await page.waitForURL('**/login', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible();
    });

    test('誤った認証情報ではログインできない', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      
      await page.click('button:has-text("ログイン")');
      
      // エラーメッセージが表示される
      await expect(page.locator('text=/メールアドレスまたはパスワードが正しくありません|Invalid login credentials/')).toBeVisible();
      
      // ダッシュボードには遷移しない
      await expect(page).toHaveURL(/.*login/);
    });
  });

  test.describe('シナリオ3: アクセス制御', () => {
    test('未認証状態で保護されたページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
      // GIVEN: ログアウトした状態（初期状態）
      
      // WHEN & THEN: /dashboardに直接アクセス
      await page.goto('/dashboard');
      await page.waitForURL('**/login?callbackUrl=%2Fdashboard', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible();
      
      // WHEN & THEN: /uploadに直接アクセス  
      await page.goto('/upload');
      await page.waitForURL('**/login?callbackUrl=%2Fupload', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible();
      
      // WHEN & THEN: /filesに直接アクセス
      await page.goto('/files');
      await page.waitForURL('**/login?callbackUrl=%2Ffiles', { timeout: 10000 });
      await expect(page.locator('text=アカウントにログイン')).toBeVisible();
    });

    test('callbackUrlパラメータが保持される', async ({ page }) => {
      // 保護されたページにアクセス
      await page.goto('/dashboard');
      await page.waitForURL('**/login?callbackUrl=%2Fdashboard');
      
      // ログイン
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button:has-text("ログイン")');
      
      // 元のページ（dashboard）にリダイレクトされる
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      await expect(page.locator('h1')).toContainText('PowerPoint Translator');
    });
  });
});
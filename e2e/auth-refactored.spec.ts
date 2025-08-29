import { test, expect } from '@playwright/test';
import { LoginPage, DashboardPage } from './page-objects';

/**
 * 認証フローテスト（Page Objectパターンを使用）
 * 
 * リファクタリング版：保守性と可読性を向上
 */
test.describe('【Refactored】ユーザー認証フロー', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    // Page Objectのインスタンス化
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe('新規ユーザー登録', () => {
    test('有効な情報で新規登録できる', async ({ page }) => {
      // 登録ページへ移動
      await page.goto('/register');
      
      // タイムスタンプを使用したユニークなメールアドレス
      const timestamp = Date.now();
      const newUserEmail = `test.${timestamp}@example.com`;
      
      // フォーム入力
      await page.fill('input[name="email"]', newUserEmail);
      await page.fill('input[name="password"]', 'ValidPassword123!');
      await page.fill('input[name="confirmPassword"]', 'ValidPassword123!');
      
      // 登録実行
      await page.click('button[type="submit"]');
      
      // ダッシュボードへのリダイレクトを確認
      await dashboardPage.waitForDashboardToLoad();
      
      // ウェルカムメッセージの確認
      const welcomeMessage = await dashboardPage.getWelcomeMessage();
      expect(welcomeMessage).toContain(newUserEmail);
    });
  });

  test.describe('ログイン＆ログアウト', () => {
    test('正しい認証情報でログインしてログアウトできる', async () => {
      // ログインページへ移動
      await loginPage.goto();
      
      // ログインフォームが表示されていることを確認
      expect(await loginPage.isLoginFormDisplayed()).toBeTruthy();
      
      // ログイン実行
      await loginPage.login('test@example.com', 'Test123456!');
      
      // ログイン成功を確認
      expect(await loginPage.isLoginSuccessful()).toBeTruthy();
      
      // ダッシュボードが表示されていることを確認
      expect(await dashboardPage.isDashboardDisplayed()).toBeTruthy();
      
      // ユーザー情報の確認
      const userEmail = await dashboardPage.getUserEmail();
      expect(userEmail).toBe('test@example.com');
      
      // ログアウト実行
      await dashboardPage.logout();
      
      // ログインページに戻ることを確認
      expect(await loginPage.isLoginFormDisplayed()).toBeTruthy();
    });

    test('誤った認証情報ではログインできない', async () => {
      // ログインページへ移動
      await loginPage.goto();
      
      // 誤ったパスワードでログイン試行
      await loginPage.login('test@example.com', 'wrongpassword');
      
      // ログインが失敗することを確認
      expect(await loginPage.isLoginSuccessful()).toBeFalsy();
      
      // エラーメッセージの確認
      const errorMessage = await loginPage.getLoginErrorMessage();
      expect(errorMessage).toMatch(/Invalid|無効|認証エラー/i);
      
      // ログインページに留まることを確認
      expect(await loginPage.isLoginFormDisplayed()).toBeTruthy();
    });

    test('空のフィールドでログインできない', async () => {
      // ログインページへ移動
      await loginPage.goto();
      
      // 空のフィールドでログイン試行
      await loginPage.clickLoginButton();
      
      // バリデーションエラーの確認
      const validationErrors = await loginPage.getValidationErrors();
      expect(validationErrors.length).toBeGreaterThan(0);
      
      // ログインページに留まることを確認
      expect(await loginPage.isLoginFormDisplayed()).toBeTruthy();
    });
  });

  test.describe('アクセス制御', () => {
    test('未認証状態で保護されたページにアクセスするとログインページにリダイレクトされる', async ({ page }) => {
      // 直接ダッシュボードにアクセス
      await dashboardPage.goto();
      
      // ログインページにリダイレクトされることを確認
      await page.waitForURL('**/login');
      expect(await loginPage.isLoginFormDisplayed()).toBeTruthy();
    });

    test('ログイン後のセッション永続性', async ({ context }) => {
      // ログイン実行
      await loginPage.goto();
      await loginPage.login('test@example.com', 'Test123456!', true); // Remember Me有効
      
      // ダッシュボード表示を確認
      expect(await dashboardPage.isDashboardDisplayed()).toBeTruthy();
      
      // 新しいタブを開く
      const newPage = await context.newPage();
      const newDashboard = new DashboardPage(newPage);
      
      // 新しいタブでもログイン状態が維持されていることを確認
      await newDashboard.goto();
      expect(await newDashboard.isDashboardDisplayed()).toBeTruthy();
      
      await newPage.close();
    });
  });

  test.describe('フォームバリデーション', () => {
    test('メールアドレスの形式チェック', async () => {
      await loginPage.goto();
      
      // 無効なメールアドレスの例
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user..@example.com'
      ];
      
      for (const email of invalidEmails) {
        await loginPage.clearForm();
        await loginPage.enterEmail(email);
        await loginPage.enterPassword('password123');
        await loginPage.clickLoginButton();
        
        // エラーまたはページに留まることを確認
        const hasError = await loginPage.getLoginErrorMessage() !== null;
        const stayedOnLoginPage = await loginPage.isLoginFormDisplayed();
        expect(hasError || stayedOnLoginPage).toBeTruthy();
      }
    });

    test('パスワードの最小長チェック', async ({ page }) => {
      await page.goto('/register');
      
      // 短すぎるパスワード
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123');
      await page.fill('input[name="confirmPassword"]', '123');
      await page.click('button[type="submit"]');
      
      // エラーメッセージの確認
      const errorVisible = await page.locator('.error-message, .text-red-500').isVisible();
      expect(errorVisible).toBeTruthy();
    });
  });

  test.describe('ソーシャルログイン', () => {
    test.skip('Googleでログイン', async () => {
      await loginPage.goto();
      
      // Googleログインボタンが存在する場合
      await loginPage.clickSocialLogin('google');
      
      // OAuth認証フローの処理（モック環境では実際の認証は行わない）
      // 実際のテストではOAuth認証をモックする必要がある
    });

    test.skip('GitHubでログイン', async () => {
      await loginPage.goto();
      
      // GitHubログインボタンが存在する場合
      await loginPage.clickSocialLogin('github');
      
      // OAuth認証フローの処理
    });
  });

  test.describe('パスワードリセット', () => {
    test('パスワードリセットリンクの動作確認', async ({ page }) => {
      await loginPage.goto();
      
      // パスワードを忘れたリンクをクリック
      await loginPage.clickForgotPassword();
      
      // パスワードリセットページへの遷移を確認
      await page.waitForURL('**/forgot-password');
      
      // パスワードリセットフォームの存在確認
      const emailInput = page.locator('input[name="email"]');
      expect(await emailInput.isVisible()).toBeTruthy();
    });
  });
});

/**
 * Page Objectパターンの利点：
 * 
 * 1. 保守性の向上
 *    - セレクタの変更が1箇所で済む
 *    - UIの変更に対して柔軟に対応可能
 * 
 * 2. 可読性の向上
 *    - テストコードがビジネスロジックに集中
 *    - 技術的な詳細が隠蔽される
 * 
 * 3. 再利用性の向上
 *    - 共通の操作を簡単に再利用
 *    - DRY原則の遵守
 * 
 * 4. テストの安定性
 *    - 待機処理の一元管理
 *    - エラーハンドリングの統一
 */
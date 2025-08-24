import { test } from '../fixtures/pages';
import { expect } from '@playwright/test';
import { TEST_USER } from '../fixtures/test-base';

/**
 * Page Object Modelベースの認証テスト
 * 各テストで独立した認証を行う
 */
test.describe('POM: 認証フロー', () => {
  
  test.describe('ログイン', () => {
    test('正常なログイン', async ({ loginPage, page }) => {
      // ログインページへ遷移
      await loginPage.goto();
      
      // 既存のテストユーザーでログイン（デバッグ用）
      const loginSuccess = await loginPage.login(TEST_USER.email, TEST_USER.password);
      
      if (loginSuccess) {
        // ダッシュボードへリダイレクトされることを確認
        await expect(page).toHaveURL(/\/dashboard/);
        
        // ログイン状態を確認
        const isLoggedIn = await loginPage.isLoggedIn();
        expect(isLoggedIn).toBeTruthy();
      } else {
        // ログイン失敗の詳細を取得
        const errorMsg = await loginPage.getErrorMessage();
        console.error('Login failed with error:', errorMsg);
        
        // テストを失敗させる
        expect(loginSuccess).toBeTruthy();
      }
    });

    test('無効な認証情報でのエラー表示', async ({ loginPage }) => {
      await loginPage.goto();
      
      // 無効な認証情報を入力
      await loginPage.fillCredentials('invalid@example.com', 'wrongpassword');
      await loginPage.clickLogin();
      
      // エラーメッセージが表示されることを確認
      const errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
      expect(errorMessage).toMatch(/認証に失敗|ログインできません|Invalid credentials/i);
      
      // ダッシュボードへリダイレクトされないことを確認
      const isLoggedIn = await loginPage.isLoggedIn();
      expect(isLoggedIn).toBeFalsy();
    });

    test('空のフォーム送信時のバリデーション', async ({ loginPage }) => {
      await loginPage.goto();
      
      // 空のフォームを送信
      await loginPage.clickLogin();
      
      // バリデーションエラーが表示されることを確認
      const emailInput = loginPage.emailInput;
      const passwordInput = loginPage.passwordInput;
      
      // HTML5バリデーションメッセージの確認
      const emailValidity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      const passwordValidity = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      
      expect(emailValidity).toBeFalsy();
      expect(passwordValidity).toBeFalsy();
    });

    test('メールアドレス形式のバリデーション', async ({ loginPage }) => {
      await loginPage.goto();
      
      // 無効なメールアドレス形式を入力
      await loginPage.fillCredentials('notanemail', 'password123');
      
      // メールフィールドのバリデーション状態を確認
      const emailInput = loginPage.emailInput;
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      
      expect(isValid).toBeFalsy();
    });
  });

  test.describe('ナビゲーション', () => {
    test('新規登録ページへのリンク', async ({ loginPage, page }) => {
      await loginPage.goto();
      
      // 新規登録リンクをクリック
      await loginPage.navigateToRegister();
      
      // 登録ページへ遷移したことを確認
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('セッション管理', () => {
    test('ログイン状態の維持', async ({ loginPage, dashboardPage, page }) => {
      // ログイン
      await loginPage.goto();
      await loginPage.login('test@example.com', 'password123');
      
      // ダッシュボードへ遷移
      await expect(page).toHaveURL(/\/dashboard/);
      
      // ページをリロード
      await page.reload();
      
      // まだログイン状態であることを確認
      await expect(page).toHaveURL(/\/dashboard/);
      
      // ダッシュボードページが正常に表示されることを確認
      await dashboardPage.goto();
      const fileCount = await dashboardPage.getFileCount();
      expect(fileCount).toBeGreaterThanOrEqual(0);
    });

    test('未認証時のリダイレクト', async ({ page, baseURL }) => {
      // 未認証状態でダッシュボードにアクセス
      await page.goto(`${baseURL}/dashboard`);
      
      // ログインページへリダイレクトされることを確認
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('アクセシビリティ', () => {
    test('キーボードナビゲーション', async ({ loginPage, page }) => {
      await loginPage.goto();
      
      // ページ本体にフォーカス
      await page.locator('body').click({ position: { x: 0, y: 0 } });
      
      // Tabキーでフォーム要素間を移動
      await page.keyboard.press('Tab');
      
      // メールフィールドにフォーカスが当たることを確認
      const emailFocused = await loginPage.emailInput.evaluate(el => el === document.activeElement);
      expect(emailFocused).toBeTruthy();
      
      // 次のフィールドへ
      await page.keyboard.press('Tab');
      
      // パスワードフィールドにフォーカスが当たることを確認
      const passwordFocused = await loginPage.passwordInput.evaluate(el => el === document.activeElement);
      expect(passwordFocused).toBeTruthy();
      
      // 送信ボタンへ
      await page.keyboard.press('Tab');
      
      // 送信ボタンにフォーカスが当たることを確認
      const submitFocused = await loginPage.submitButton.evaluate(el => el === document.activeElement);
      expect(submitFocused).toBeTruthy();
    });

    test('ARIA属性の検証', async ({ loginPage }) => {
      await loginPage.goto();
      
      // フォーム要素のARIA属性を確認
      const emailAriaLabel = await loginPage.emailInput.getAttribute('aria-label');
      const passwordAriaLabel = await loginPage.passwordInput.getAttribute('aria-label');
      const submitAriaLabel = await loginPage.submitButton.getAttribute('aria-label');
      
      // 少なくとも基本的なアクセシビリティ属性が存在することを確認
      const emailId = await loginPage.emailInput.getAttribute('id');
      const passwordId = await loginPage.passwordInput.getAttribute('id');
      
      expect(emailAriaLabel || emailId).toBeTruthy();
      expect(passwordAriaLabel || passwordId).toBeTruthy();
      expect(submitAriaLabel || await loginPage.submitButton.textContent()).toBeTruthy();
    });
  });

  test.describe('エラーリカバリー', () => {
    test('エラー後の再試行', async ({ loginPage, page }) => {
      await loginPage.goto();
      
      // 最初に間違った認証情報でログイン
      await loginPage.fillCredentials('test@example.com', 'wrongpassword');
      await loginPage.clickLogin();
      
      // エラーメッセージが表示される
      let errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
      
      // 正しい認証情報で再試行
      await loginPage.fillCredentials('test@example.com', 'password123');
      await loginPage.clickLogin();
      
      // 成功してダッシュボードへ遷移
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });

    test('フォームのクリアと再入力', async ({ loginPage }) => {
      await loginPage.goto();
      
      // 最初の入力
      await loginPage.fillCredentials('first@example.com', 'firstpassword');
      
      // 入力値を確認
      let emailValue = await loginPage.emailInput.inputValue();
      let passwordValue = await loginPage.passwordInput.inputValue();
      expect(emailValue).toBe('first@example.com');
      expect(passwordValue).toBe('firstpassword');
      
      // フィールドをクリアして再入力
      await loginPage.emailInput.clear();
      await loginPage.passwordInput.clear();
      await loginPage.fillCredentials('second@example.com', 'secondpassword');
      
      // 新しい値を確認
      emailValue = await loginPage.emailInput.inputValue();
      passwordValue = await loginPage.passwordInput.inputValue();
      expect(emailValue).toBe('second@example.com');
      expect(passwordValue).toBe('secondpassword');
    });
  });
});
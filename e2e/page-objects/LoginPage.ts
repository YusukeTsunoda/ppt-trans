import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage - ログインページのPage Object
 */
export class LoginPage extends BasePage {
  // セレクタの定義
  private readonly selectors = {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    submitButton: 'button[type="submit"]',
    loginButton: 'button:has-text("ログイン"), button:has-text("Login")',
    forgotPasswordLink: 'a:has-text("パスワードを忘れた"), a:has-text("Forgot password")',
    signUpLink: 'a:has-text("新規登録"), a:has-text("Sign up")',
    rememberMeCheckbox: 'input[type="checkbox"][name="remember"]',
    errorMessage: '.error-message, .text-red-500, [role="alert"]',
    successMessage: '.success-message, .text-green-500',
    pageTitle: 'h1',
    loadingIndicator: '.loading, .spinner'
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * ログインページへナビゲート
   */
  async goto(): Promise<void> {
    await this.navigate('/login');
    await this.waitForPageLoad();
  }

  /**
   * ログインを実行
   */
  async login(email: string, password: string, rememberMe: boolean = false): Promise<void> {
    await this.enterEmail(email);
    await this.enterPassword(password);
    
    if (rememberMe) {
      await this.checkRememberMe();
    }
    
    await this.clickLoginButton();
  }

  /**
   * メールアドレスを入力
   */
  async enterEmail(email: string): Promise<void> {
    await this.fill(this.selectors.emailInput, email);
  }

  /**
   * パスワードを入力
   */
  async enterPassword(password: string): Promise<void> {
    await this.fill(this.selectors.passwordInput, password);
  }

  /**
   * ログインボタンをクリック
   */
  async clickLoginButton(): Promise<void> {
    await this.click(this.selectors.submitButton);
    await this.waitForLoadingToComplete();
  }

  /**
   * Remember Meチェックボックスをチェック
   */
  async checkRememberMe(): Promise<void> {
    if (await this.isElementVisible(this.selectors.rememberMeCheckbox)) {
      await this.check(this.selectors.rememberMeCheckbox);
    }
  }

  /**
   * パスワードを忘れたリンクをクリック
   */
  async clickForgotPassword(): Promise<void> {
    await this.click(this.selectors.forgotPasswordLink);
  }

  /**
   * 新規登録リンクをクリック
   */
  async clickSignUpLink(): Promise<void> {
    await this.click(this.selectors.signUpLink);
  }

  /**
   * ログインが成功したか確認
   */
  async isLoginSuccessful(): Promise<boolean> {
    try {
      // ダッシュボードへのリダイレクトを待つ
      await this.waitForURL('**/dashboard', 5000);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * エラーメッセージを取得
   */
  async getLoginErrorMessage(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getElementText(this.selectors.errorMessage);
    }
    return null;
  }

  /**
   * ページタイトルを取得
   */
  async getPageHeading(): Promise<string> {
    return await this.getElementText(this.selectors.pageTitle);
  }

  /**
   * フォームをクリア
   */
  async clearForm(): Promise<void> {
    await this.fill(this.selectors.emailInput, '');
    await this.fill(this.selectors.passwordInput, '');
  }

  /**
   * メールフィールドが表示されているか
   */
  async isEmailFieldVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.emailInput);
  }

  /**
   * パスワードフィールドが表示されているか
   */
  async isPasswordFieldVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.passwordInput);
  }

  /**
   * ログインボタンが有効か
   */
  async isLoginButtonEnabled(): Promise<boolean> {
    return await this.isElementEnabled(this.selectors.submitButton);
  }

  /**
   * フォームのバリデーションエラーを取得
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // HTML5バリデーションメッセージを取得
    const emailValidation = await this.page.evaluate((selector) => {
      const input = document.querySelector(selector) as HTMLInputElement;
      return input?.validationMessage || '';
    }, this.selectors.emailInput);
    
    const passwordValidation = await this.page.evaluate((selector) => {
      const input = document.querySelector(selector) as HTMLInputElement;
      return input?.validationMessage || '';
    }, this.selectors.passwordInput);
    
    if (emailValidation) errors.push(emailValidation);
    if (passwordValidation) errors.push(passwordValidation);
    
    return errors;
  }

  /**
   * ソーシャルログインボタンをクリック
   */
  async clickSocialLogin(provider: 'google' | 'github' | 'facebook'): Promise<void> {
    const selector = `button:has-text("${provider}"), a:has-text("${provider}")`;
    if (await this.isElementVisible(selector)) {
      await this.click(selector);
    }
  }

  /**
   * ログインフォームが表示されているか確認
   */
  async isLoginFormDisplayed(): Promise<boolean> {
    const emailVisible = await this.isEmailFieldVisible();
    const passwordVisible = await this.isPasswordFieldVisible();
    const buttonEnabled = await this.isLoginButtonEnabled();
    
    return emailVisible && passwordVisible && buttonEnabled;
  }
}
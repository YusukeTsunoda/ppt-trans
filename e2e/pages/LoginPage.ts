import { Page, Locator } from '@playwright/test';

/**
 * ログインページのPage Object
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // 要素のロケーター定義
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]:has-text("ログイン")');
    this.errorMessage = page.locator('[role="alert"], .error-message');
    this.registerLink = page.locator('a:has-text("新規登録")');
  }
  
  /**
   * ページへ遷移
   */
  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }
  
  /**
   * ログインフォームに入力
   */
  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }
  
  /**
   * ログインボタンをクリック
   */
  async clickLogin() {
    await this.submitButton.click();
  }
  
  /**
   * ログインを実行
   */
  async login(email: string, password: string) {
    await this.fillCredentials(email, password);
    await this.clickLogin();
    
    // ダッシュボードへの遷移を待つ
    await this.page.waitForURL('**/dashboard', { timeout: 15000 });
  }
  
  /**
   * エラーメッセージを取得
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * ログイン状態を確認
   */
  async isLoggedIn(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/dashboard');
  }
  
  /**
   * 新規登録ページへ遷移
   */
  async navigateToRegister() {
    await this.registerLink.click();
    await this.page.waitForURL('**/register');
  }
}
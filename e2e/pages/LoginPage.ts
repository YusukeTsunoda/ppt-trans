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
   * ログインを実行（堅牢版）
   */
  async login(email: string, password: string): Promise<boolean> {
    try {
      // ネットワークが安定するまで待つ
      await this.page.waitForLoadState('networkidle');
      
      // 認証情報を入力
      await this.fillCredentials(email, password);
      
      // ボタンが有効であることを確認
      await this.submitButton.waitFor({ state: 'visible' });
      const isDisabled = await this.submitButton.isDisabled();
      if (isDisabled) {
        console.error('Login button is disabled');
        return false;
      }
      
      // ログインボタンをクリックし、レスポンスを待つ
      await Promise.all([
        this.page.waitForResponse(
          response => response.url().includes('/login') && response.status() === 200,
          { timeout: 10000 }
        ).catch(() => null), // エラーを無視
        this.clickLogin(),
      ]);
      
      // 成功/失敗の判定
      // 1. エラーメッセージが表示されていないか確認
      const errorVisible = await this.errorMessage.isVisible().catch(() => false);
      if (errorVisible) {
        const errorText = await this.errorMessage.textContent();
        console.error('Login error:', errorText);
        return false;
      }
      
      // 2. URLがダッシュボードに変わるのを待つ
      try {
        await this.page.waitForURL('**/dashboard', { timeout: 10000 });
      } catch {
        // URLが変わらない場合、ログイン失敗
        const currentUrl = this.page.url();
        if (currentUrl.includes('/login')) {
          console.error('Login failed - still on login page');
          return false;
        }
      }
      
      // 3. ダッシュボード固有の要素が表示されることを確認
      const dashboardIndicators = [
        '[data-testid="dashboard-welcome"]',
        '[data-testid="user-menu"]',
        'text=/ようこそ|Welcome|Dashboard/i',
      ];
      
      let dashboardLoaded = false;
      for (const selector of dashboardIndicators) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          dashboardLoaded = true;
          break;
        } catch {
          // このセレクタは見つからなかった
        }
      }
      
      if (!dashboardLoaded) {
        console.warn('Dashboard elements not found, but URL changed');
      }
      
      return true;
    } catch (error) {
      console.error('Login failed with error:', error);
      
      // デバッグ用: スクリーンショットを保存
      await this.page.screenshot({ 
        path: `test-results/login-failure-${Date.now()}.png`,
        fullPage: true 
      });
      
      return false;
    }
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
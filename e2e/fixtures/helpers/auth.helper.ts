import { Page } from '@playwright/test';
import { TestConfig, TestUser } from '../../config/test-config';
import { LoginPage } from '../../page-objects/login.page';

export class AuthHelper {
  constructor(private page: Page) {}
  
  /**
   * ユーザーとしてログイン
   */
  async loginAs(user: TestUser | 'default' | 'admin' | 'user1') {
    const loginPage = new LoginPage(this.page);
    await loginPage.goto();
    
    const userData = typeof user === 'string' ? TestConfig.users[user] : user;
    await loginPage.login(userData.email, userData.password);
    await loginPage.waitForSuccessfulLogin();
  }
  
  /**
   * ログアウト
   */
  async logout() {
    await this.page.click(TestConfig.selectors.auth.logoutButton);
    await this.page.waitForURL('**/login', {
      timeout: TestConfig.timeouts.navigation
    });
  }
  
  /**
   * 認証状態の保存
   */
  async saveAuthState(path: string = '.auth/user.json') {
    await this.page.context().storageState({ path });
  }
  
  /**
   * 認証状態の確認
   */
  async isAuthenticated(): Promise<boolean> {
    const cookies = await this.page.context().cookies();
    const hasAuthCookie = cookies.some(c => 
      c.name.includes('auth') || c.name.includes('sb-')
    );
    
    if (!hasAuthCookie) return false;
    
    // ダッシュボードにアクセスしてみる
    await this.page.goto('/dashboard');
    return !this.page.url().includes('/login');
  }
  
  /**
   * セッションの検証
   */
  async validateSession() {
    const response = await this.page.request.get('/api/auth/session');
    return response.ok() && (await response.json()).user !== null;
  }
  
  /**
   * パスワードリセットフロー
   */
  async resetPassword(email: string) {
    await this.page.goto('/login');
    await this.page.click('a:has-text("パスワードを忘れた")');
    await this.page.fill('input[type="email"]', email);
    await this.page.click('button:has-text("リセットメールを送信")');
    
    // メール送信確認
    await this.page.waitForSelector('text=/メールを送信しました/');
  }
  
  /**
   * レート制限のテスト
   */
  async testRateLimit(attempts: number = 5) {
    const results: boolean[] = [];
    
    for (let i = 0; i < attempts; i++) {
      try {
        await this.page.goto('/login');
        await this.page.fill('input[type="email"]', 'test@example.com');
        await this.page.fill('input[type="password"]', `wrong_${i}`);
        await this.page.click('button[type="submit"]');
        
        const hasError = await this.page.locator('.bg-red-50').isVisible();
        results.push(hasError);
        
        await this.page.waitForTimeout(500);
      } catch (error) {
        results.push(false);
      }
    }
    
    return results;
  }
}
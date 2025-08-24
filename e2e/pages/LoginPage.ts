import { Page, expect } from '@playwright/test';
import { TEST_CONFIG, getTestId } from '../fixtures/test-config-v2';

/**
 * ログインページのPage Object
 */
export class LoginPage {
  constructor(private page: Page) {}
  
  // ページ要素
  get emailInput() {
    return this.page.locator('input[type="email"]');
  }
  
  get passwordInput() {
    return this.page.locator('input[type="password"]');
  }
  
  get submitButton() {
    return this.page.locator('button[type="submit"]');
  }
  
  get errorMessage() {
    return this.page.locator(getTestId('errorMessage'));
  }
  
  get forgotPasswordLink() {
    return this.page.locator('a:has-text("パスワードをお忘れですか")');
  }
  
  get registerLink() {
    return this.page.locator('a:has-text("新規登録")');
  }
  
  // ページアクション
  async navigate() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }
  
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }
  
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }
  
  async submit() {
    await this.submitButton.click();
  }
  
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }
  
  async loginAsStandardUser() {
    await this.login(
      TEST_CONFIG.users.standard.email,
      TEST_CONFIG.users.standard.password
    );
  }
  
  async loginAsAdminUser() {
    await this.login(
      TEST_CONFIG.users.admin.email,
      TEST_CONFIG.users.admin.password
    );
  }
  
  // 検証メソッド
  async expectLoginSuccess() {
    await this.page.waitForURL('**/dashboard', {
      timeout: TEST_CONFIG.timeouts.navigation
    });
    await expect(this.page).toHaveURL(/.*\/dashboard/);
  }
  
  async expectLoginError(errorText?: string) {
    await expect(this.errorMessage).toBeVisible({
      timeout: TEST_CONFIG.timeouts.quick
    });
    if (errorText) {
      await expect(this.errorMessage).toContainText(errorText);
    }
  }
  
  async expectToBeOnLoginPage() {
    await expect(this.page).toHaveURL(/.*\/login/);
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
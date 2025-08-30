import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { TestConfig } from '../config/test-config';
import { ServerActionsHelper } from '../helpers/server-actions-helper';

export class LoginPage extends BasePage {
  // ページ要素の定義
  get emailInput(): Locator {
    return this.page.locator(TestConfig.selectors.auth.emailInput);
  }
  
  get passwordInput(): Locator {
    return this.page.locator(TestConfig.selectors.auth.passwordInput);
  }
  
  get submitButton(): Locator {
    return this.page.locator(TestConfig.selectors.auth.submitButton);
  }
  
  get errorMessage(): Locator {
    return this.page.locator(TestConfig.selectors.auth.errorMessage);
  }
  
  get forgotPasswordLink(): Locator {
    return this.page.locator('a:has-text("パスワードを忘れた")');
  }
  
  get registerLink(): Locator {
    return this.page.locator('a[href="/register"]');
  }
  
  // ページメソッド
  async goto() {
    await super.goto('/login');
  }
  
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
  
  async loginAsDefaultUser() {
    const user = TestConfig.users.default;
    await this.login(user.email, user.password);
    await this.waitForSuccessfulLogin();
  }
  
  async loginAsAdmin() {
    const admin = TestConfig.users.admin;
    await this.login(admin.email, admin.password);
    await this.waitForSuccessfulLogin();
  }
  
  async waitForSuccessfulLogin() {
    await this.page.waitForURL('**/dashboard', {
      timeout: TestConfig.timeouts.navigation
    });
  }
  
  async expectError(message?: string | RegExp) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }
  
  async isLoggedIn(): Promise<boolean> {
    const cookies = await this.page.context().cookies();
    return cookies.some(c => c.name.includes('auth') || c.name.includes('sb-'));
  }
  
  // バリデーション検証
  async validateEmailField() {
    // 空の場合
    await this.emailInput.clear();
    await this.submitButton.click();
    const validationMessage = await this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
    
    // 不正な形式
    await this.emailInput.fill('invalid-email');
    await this.submitButton.click();
    const isValid = await this.emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  }
  
  // セキュリティテスト用メソッド
  async attemptSQLInjection() {
    await this.emailInput.fill("admin' OR '1'='1");
    await this.passwordInput.fill("' OR '1'='1");
    await this.submitButton.click();
    
    // SQLインジェクションが失敗することを確認
    await this.expectError();
    expect(this.page.url()).toContain('/login');
  }
  
  async attemptXSS() {
    const xssPayload = '<script>alert("XSS")</script>';
    await this.emailInput.fill(xssPayload + '@test.com');
    await this.passwordInput.fill('password123');
    
    // XSSアラートが発生しないことを確認
    let xssTriggered = false;
    this.page.on('dialog', () => {
      xssTriggered = true;
    });
    
    await this.submitButton.click();
    await this.page.waitForTimeout(2000);
    expect(xssTriggered).toBe(false);
  }
  
  // Server Actions対応メソッド
  async loginWithServerAction(email: string, password: string) {
    await ServerActionsHelper.fillAndSubmitForm(
      this.page,
      { email, password },
      TestConfig.selectors.auth.submitButton,
      /.*\/dashboard/
    );
  }
  
  async loginAsDefaultUserWithServerAction() {
    const user = TestConfig.users.default;
    await this.loginWithServerAction(user.email, user.password);
  }
  
  async loginAsAdminWithServerAction() {
    const admin = TestConfig.users.admin;
    await this.loginWithServerAction(admin.email, admin.password);
  }
  
  async expectServerActionError() {
    const hasError = await ServerActionsHelper.hasServerActionError(this.page);
    expect(hasError).toBe(true);
  }
  
  async getServerActionErrorMessage(): Promise<string | null> {
    return await ServerActionsHelper.getServerActionError(this.page);
  }
}
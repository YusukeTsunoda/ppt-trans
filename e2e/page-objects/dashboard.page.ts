import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { TestConfig } from '../config/test-config';

export class DashboardPage extends BasePage {
  // ページ要素の定義
  get welcomeMessage(): Locator {
    return this.page.locator('text=/ようこそ|Welcome/');
  }
  
  get uploadButton(): Locator {
    return this.page.locator('a:has-text("新規アップロード"), button:has-text("アップロード")');
  }
  
  get fileList(): Locator {
    return this.page.locator('[data-testid="file-list"], .file-list');
  }
  
  get logoutButton(): Locator {
    return this.page.locator(TestConfig.selectors.auth.logoutButton);
  }
  
  get userMenu(): Locator {
    return this.page.locator('[data-testid="user-menu-button"]');
  }
  
  // ページメソッド
  async goto() {
    await super.goto('/dashboard');
  }
  
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.welcomeMessage).toBeVisible({
      timeout: TestConfig.timeouts.element
    });
  }
  
  async navigateToUpload() {
    await this.uploadButton.click();
    await this.page.waitForURL('**/upload', {
      timeout: TestConfig.timeouts.navigation
    });
  }
  
  async navigateToFiles() {
    await this.navFiles.click();
    await this.page.waitForURL('**/files', {
      timeout: TestConfig.timeouts.navigation
    });
  }
  
  async logout() {
    // ユーザーメニューを開く
    if (await this.userMenu.isVisible()) {
      await this.userMenu.click();
    }
    
    await this.logoutButton.click();
    await this.page.waitForURL('**/login', {
      timeout: TestConfig.timeouts.navigation
    });
  }
  
  async getUploadedFiles(): Promise<string[]> {
    const fileItems = this.fileList.locator('.file-item, [data-testid="file-item"]');
    const count = await fileItems.count();
    const files: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const fileName = await fileItems.nth(i).textContent();
      if (fileName) files.push(fileName);
    }
    
    return files;
  }
  
  async hasNoFiles(): Promise<boolean> {
    const noFilesMessage = this.page.locator('text=/まだファイルがアップロードされていません|No files uploaded/');
    return await noFilesMessage.isVisible();
  }
  
  async getStatistics() {
    const stats = {
      totalFiles: 0,
      totalTranslations: 0,
      recentActivity: []
    };
    
    // 統計情報を取得（実装に応じて調整）
    const totalFilesElement = this.page.locator('[data-testid="total-files"]');
    if (await totalFilesElement.isVisible()) {
      const text = await totalFilesElement.textContent();
      stats.totalFiles = parseInt(text?.match(/\d+/)?.[0] || '0');
    }
    
    return stats;
  }
}
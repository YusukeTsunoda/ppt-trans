import { Page, Locator, expect } from '@playwright/test';
import { TestConfig } from '../config/test-config';

/**
 * 全ページオブジェクトの基底クラス
 */
export abstract class BasePage {
  protected readonly page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  // 共通ナビゲーション要素
  get navDashboard(): Locator {
    return this.page.locator(TestConfig.selectors.navigation.dashboard);
  }
  
  get navUpload(): Locator {
    return this.page.locator(TestConfig.selectors.navigation.upload);
  }
  
  get navFiles(): Locator {
    return this.page.locator(TestConfig.selectors.navigation.files);
  }
  
  get navProfile(): Locator {
    return this.page.locator(TestConfig.selectors.navigation.profile);
  }
  
  // 共通メソッド
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }
  
  async waitForElement(selector: string, timeout?: number) {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: timeout || TestConfig.timeouts.element
    });
  }
  
  async clickAndWait(locator: Locator, waitForUrl?: string | RegExp) {
    await locator.click();
    if (waitForUrl) {
      await this.page.waitForURL(waitForUrl, {
        timeout: TestConfig.timeouts.navigation
      });
    }
  }
  
  async fillForm(data: Record<string, string>) {
    for (const [selector, value] of Object.entries(data)) {
      await this.page.fill(selector, value);
    }
  }
  
  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }
  
  async measurePerformance() {
    return await this.page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        domInteractive: perfData.domInteractive - perfData.fetchStart,
        responseTime: perfData.responseEnd - perfData.requestStart,
      };
    });
  }
}
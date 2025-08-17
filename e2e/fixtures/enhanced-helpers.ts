import { Page, Locator, expect } from '@playwright/test';

/**
 * 拡張されたE2Eテストヘルパー関数
 * Phase 2: より堅牢で再利用可能なユーティリティ
 */

/**
 * 要素の待機とアサーション
 */
export class ElementWaiter {
  constructor(private page: Page) {}

  /**
   * 要素が表示されるまで待機（リトライ付き）
   */
  async waitForVisible(
    selector: string,
    options: {
      timeout?: number;
      retries?: number;
      retryDelay?: number;
      message?: string;
    } = {}
  ): Promise<Locator> {
    const { 
      timeout = 5000, 
      retries = 3, 
      retryDelay = 500,
      message = `要素 ${selector} が表示されませんでした`
    } = options;

    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const element = this.page.locator(selector);
        await expect(element).toBeVisible({ timeout, message });
        return element;
      } catch (error) {
        lastError = error as Error;
        if (i < retries - 1) {
          await this.page.waitForTimeout(retryDelay);
        }
      }
    }

    throw lastError || new Error(message);
  }

  /**
   * 要素が非表示になるまで待機
   */
  async waitForHidden(
    selector: string,
    timeout = 5000
  ): Promise<void> {
    const element = this.page.locator(selector);
    await expect(element).toBeHidden({ timeout });
  }

  /**
   * 要素のテキストが特定の値になるまで待機
   */
  async waitForText(
    selector: string,
    expectedText: string | RegExp,
    timeout = 5000
  ): Promise<void> {
    const element = this.page.locator(selector);
    await expect(element).toHaveText(expectedText, { timeout });
  }
}

/**
 * フォーム操作のヘルパー
 */
export class FormHelper {
  constructor(private page: Page) {}

  /**
   * フォームフィールドの一括入力
   */
  async fillFields(fields: Array<{
    selector: string;
    value: string;
    type?: 'text' | 'select' | 'checkbox' | 'radio';
  }>): Promise<void> {
    for (const field of fields) {
      const element = this.page.locator(field.selector);
      
      switch (field.type) {
        case 'select':
          await element.selectOption(field.value);
          break;
        case 'checkbox':
          if (field.value === 'true') {
            await element.check();
          } else {
            await element.uncheck();
          }
          break;
        case 'radio':
          await element.check();
          break;
        default:
          await element.fill(field.value);
      }
      
      // 入力後の短い待機
      await this.page.waitForTimeout(100);
    }
  }

  /**
   * フォームのバリデーションエラーを取得
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // HTML5バリデーションエラー
    const invalidInputs = await this.page.locator(':invalid').all();
    for (const input of invalidInputs) {
      const message = await input.evaluate((el: HTMLInputElement) => 
        el.validationMessage
      );
      if (message) errors.push(message);
    }
    
    // カスタムエラーメッセージ
    const errorElements = await this.page.locator('.error-message, [role="alert"]').all();
    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) errors.push(text.trim());
    }
    
    return errors;
  }

  /**
   * フォームの送信と結果待機
   */
  async submitAndWait(
    submitSelector: string,
    successCondition: () => Promise<boolean>,
    timeout = 10000
  ): Promise<boolean> {
    const submitButton = this.page.locator(submitSelector);
    await submitButton.click();
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await successCondition()) {
        return true;
      }
      await this.page.waitForTimeout(100);
    }
    
    return false;
  }
}

/**
 * ネットワーク操作のヘルパー
 */
export class NetworkHelper {
  constructor(private page: Page) {}

  /**
   * 特定のAPIレスポンスを待機
   */
  async waitForApiResponse(
    urlPattern: string | RegExp,
    options: {
      method?: string;
      statusCode?: number;
      timeout?: number;
    } = {}
  ): Promise<any> {
    const { method = 'GET', statusCode = 200, timeout = 10000 } = options;
    
    const responsePromise = this.page.waitForResponse(
      response => {
        const urlMatch = typeof urlPattern === 'string' 
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
        
        return urlMatch && 
               response.request().method() === method &&
               response.status() === statusCode;
      },
      { timeout }
    );
    
    const response = await responsePromise;
    return await response.json();
  }

  /**
   * ネットワークアイドル状態を待機（改善版）
   */
  async waitForNetworkIdle(options: {
    timeout?: number;
    maxInflightRequests?: number;
  } = {}): Promise<void> {
    const { timeout = 3000, maxInflightRequests = 0 } = options;
    
    await this.page.waitForLoadState('networkidle', { timeout });
    
    // 追加の安定性チェック
    await this.page.evaluate(() => {
      return new Promise(resolve => {
        if (document.readyState === 'complete') {
          resolve(true);
        } else {
          window.addEventListener('load', () => resolve(true));
        }
      });
    });
    
    // レンダリング完了待ち
    await this.page.waitForTimeout(200);
  }

  /**
   * APIモックの設定
   */
  async mockApiResponse(
    urlPattern: string | RegExp,
    response: {
      status?: number;
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<void> {
    await this.page.route(urlPattern, async route => {
      await route.fulfill({
        status: response.status || 200,
        contentType: 'application/json',
        headers: response.headers,
        body: JSON.stringify(response.body || {})
      });
    });
  }
}

/**
 * アクセシビリティヘルパー
 */
export class AccessibilityHelper {
  constructor(private page: Page) {}

  /**
   * フォーカス可能な要素を順番に取得
   */
  async getFocusableElements(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');
      
      const elements = document.querySelectorAll(focusableSelectors);
      return Array.from(elements).map(el => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
        const text = (el as HTMLElement).textContent?.trim().substring(0, 20) || '';
        return `${tag}${id}${classes} "${text}"`;
      });
    });
  }

  /**
   * Tab順序のテスト
   */
  async testTabOrder(expectedOrder: string[]): Promise<boolean> {
    const actualOrder: string[] = [];
    
    // ページ本体にフォーカス
    await this.page.locator('body').click({ position: { x: 0, y: 0 } });
    
    for (let i = 0; i < expectedOrder.length; i++) {
      await this.page.keyboard.press('Tab');
      
      const focusedElement = await this.page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        
        const id = el.id || '';
        const dataTestId = el.getAttribute('data-testid') || '';
        const text = (el as HTMLElement).textContent?.trim() || '';
        
        return { id, dataTestId, text };
      });
      
      if (focusedElement) {
        actualOrder.push(
          focusedElement.dataTestId || 
          focusedElement.id || 
          focusedElement.text
        );
      }
    }
    
    return JSON.stringify(actualOrder) === JSON.stringify(expectedOrder);
  }

  /**
   * ARIA属性の検証
   */
  async validateAriaAttributes(selector: string): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const element = this.page.locator(selector);
    const issues: string[] = [];
    
    // 必須ARIA属性のチェック
    const role = await element.getAttribute('role');
    const ariaLabel = await element.getAttribute('aria-label');
    const ariaLabelledBy = await element.getAttribute('aria-labelledby');
    const ariaDescribedBy = await element.getAttribute('aria-describedby');
    
    // インタラクティブ要素のチェック
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
    const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(tagName);
    
    if (isInteractive && !ariaLabel && !ariaLabelledBy) {
      const textContent = await element.textContent();
      if (!textContent?.trim()) {
        issues.push('インタラクティブ要素にラベルがありません');
      }
    }
    
    // フォーム要素の追加チェック
    if (['input', 'select', 'textarea'].includes(tagName)) {
      const ariaRequired = await element.getAttribute('aria-required');
      const required = await element.getAttribute('required');
      
      if (required && ariaRequired !== 'true') {
        issues.push('required属性がある場合はaria-required="true"も設定してください');
      }
      
      const ariaInvalid = await element.getAttribute('aria-invalid');
      const isInvalid = await element.evaluate((el: HTMLInputElement) => !el.validity.valid);
      
      if (isInvalid && ariaInvalid !== 'true') {
        issues.push('無効な入力にはaria-invalid="true"を設定してください');
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * データ管理ヘルパー
 */
export class DataHelper {
  constructor(private page: Page) {}

  /**
   * テストデータの生成
   */
  generateTestData(template: string, index: number): any {
    const timestamp = Date.now();
    return JSON.parse(
      template
        .replace(/{{index}}/g, index.toString())
        .replace(/{{timestamp}}/g, timestamp.toString())
        .replace(/{{random}}/g, Math.random().toString(36).substring(7))
    );
  }

  /**
   * ローカルストレージの操作
   */
  async setLocalStorage(key: string, value: any): Promise<void> {
    await this.page.evaluate(({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    }, { key, value });
  }

  async getLocalStorage(key: string): Promise<any> {
    return await this.page.evaluate((key) => {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    }, key);
  }

  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }

  /**
   * セッションストレージの操作
   */
  async setSessionStorage(key: string, value: any): Promise<void> {
    await this.page.evaluate(({ key, value }) => {
      sessionStorage.setItem(key, JSON.stringify(value));
    }, { key, value });
  }

  async getSessionStorage(key: string): Promise<any> {
    return await this.page.evaluate((key) => {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    }, key);
  }

  /**
   * Cookieの操作
   */
  async setCookie(name: string, value: string, options?: any): Promise<void> {
    await this.page.context().addCookies([{
      name,
      value,
      url: this.page.url(),
      ...options
    }]);
  }

  async getCookie(name: string): Promise<string | null> {
    const cookies = await this.page.context().cookies();
    const cookie = cookies.find(c => c.name === name);
    return cookie ? cookie.value : null;
  }
}

/**
 * スクリーンショットヘルパー
 */
export class ScreenshotHelper {
  constructor(private page: Page) {}

  /**
   * 失敗時の自動スクリーンショット
   */
  async captureOnFailure(testName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `failure-${testName}-${timestamp}.png`;
    const path = `test-results/screenshots/${fileName}`;
    
    await this.page.screenshot({ 
      path,
      fullPage: true 
    });
    
    return path;
  }

  /**
   * 要素のスクリーンショット
   */
  async captureElement(selector: string, fileName: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.screenshot({ 
      path: `test-results/screenshots/${fileName}` 
    });
  }

  /**
   * ビジュアルリグレッションテスト用のスクリーンショット
   */
  async captureForComparison(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test-results/visual-regression/${name}.png`,
      fullPage: true,
      animations: 'disabled',
      caret: 'hide'
    });
  }
}

/**
 * ヘルパーファクトリー
 */
export function createHelpers(page: Page) {
  return {
    element: new ElementWaiter(page),
    form: new FormHelper(page),
    network: new NetworkHelper(page),
    accessibility: new AccessibilityHelper(page),
    data: new DataHelper(page),
    screenshot: new ScreenshotHelper(page)
  };
}

/**
 * グローバルテストヘルパー
 */
export const testHelpers = {
  /**
   * テスト環境のセットアップ
   */
  async setupTestEnvironment(page: Page): Promise<void> {
    // ビューポートサイズの設定
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // タイムゾーンの設定
    await page.context().setGeolocation({ latitude: 35.6762, longitude: 139.6503 });
    await page.context().setLocale('ja-JP');
    
    // コンソールエラーの監視
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('ブラウザコンソールエラー:', msg.text());
      }
    });
    
    // ページエラーの監視
    page.on('pageerror', error => {
      console.error('ページエラー:', error.message);
    });
  },

  /**
   * テスト後のクリーンアップ
   */
  async cleanupTestEnvironment(page: Page): Promise<void> {
    // ローカルストレージのクリア
    await page.evaluate(() => localStorage.clear());
    
    // セッションストレージのクリア
    await page.evaluate(() => sessionStorage.clear());
    
    // Cookieのクリア
    await page.context().clearCookies();
  }
};
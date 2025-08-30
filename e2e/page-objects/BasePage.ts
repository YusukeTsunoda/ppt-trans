import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage - すべてのPage Objectの基底クラス
 * 
 * 共通の機能とユーティリティメソッドを提供します
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL || 'http://localhost:3000';
  }

  /**
   * ページへナビゲート
   */
  async navigate(path: string = ''): Promise<void> {
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * 現在のURLを取得
   */
  async getCurrentURL(): Promise<string> {
    return this.page.url();
  }

  /**
   * 指定したURLパターンを待つ
   */
  async waitForURL(urlPattern: string | RegExp, timeout: number = 10000): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  /**
   * 要素が表示されるまで待つ
   */
  async waitForElement(selector: string, timeout: number = 5000): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * 要素が非表示になるまで待つ
   */
  async waitForElementToDisappear(selector: string, timeout: number = 5000): Promise<void> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * テキストを含む要素を待つ
   */
  async waitForText(text: string, timeout: number = 5000): Promise<Locator> {
    const locator = this.page.locator(`text=${text}`);
    await locator.waitFor({ state: 'visible', timeout });
    return locator;
  }

  /**
   * スクリーンショットを撮る
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `screenshots/${name}-${timestamp}.png`,
      fullPage: true
    });
  }

  /**
   * ページのタイトルを取得
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * ページをリロード
   */
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
  }

  /**
   * ブラウザの戻るボタンをクリック
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle' });
  }

  /**
   * ブラウザの進むボタンをクリック
   */
  async goForward(): Promise<void> {
    await this.page.goForward({ waitUntil: 'networkidle' });
  }

  /**
   * ローカルストレージの値を取得
   */
  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => localStorage.getItem(k), key);
  }

  /**
   * ローカルストレージに値を設定
   */
  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value]);
  }

  /**
   * ローカルストレージをクリア
   */
  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }

  /**
   * Cookieを取得
   */
  async getCookies(): Promise<any[]> {
    return await this.page.context().cookies();
  }

  /**
   * Cookieを設定
   */
  async setCookie(cookie: any): Promise<void> {
    await this.page.context().addCookies([cookie]);
  }

  /**
   * すべてのCookieをクリア
   */
  async clearCookies(): Promise<void> {
    await this.page.context().clearCookies();
  }

  /**
   * アラートダイアログを処理
   */
  async handleAlert(accept: boolean = true, promptText?: string): Promise<void> {
    this.page.once('dialog', async dialog => {
      if (promptText && dialog.type() === 'prompt') {
        await dialog.accept(promptText);
      } else if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  /**
   * ネットワークリクエストを待つ
   */
  async waitForRequest(urlPattern: string | RegExp, timeout: number = 5000): Promise<void> {
    await this.page.waitForRequest(urlPattern, { timeout });
  }

  /**
   * ネットワークレスポンスを待つ
   */
  async waitForResponse(urlPattern: string | RegExp, timeout: number = 5000): Promise<void> {
    await this.page.waitForResponse(urlPattern, { timeout });
  }

  /**
   * 要素のテキストを取得
   */
  async getElementText(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return await element.textContent() || '';
  }

  /**
   * 要素の属性を取得
   */
  async getElementAttribute(selector: string, attribute: string): Promise<string | null> {
    const element = await this.waitForElement(selector);
    return await element.getAttribute(attribute);
  }

  /**
   * 要素が存在するかチェック
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * 要素が有効かチェック
   */
  async isElementEnabled(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * 要素をクリック
   */
  async click(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.click();
  }

  /**
   * 要素にテキストを入力
   */
  async fill(selector: string, value: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.fill(value);
  }

  /**
   * セレクトボックスの値を選択
   */
  async selectOption(selector: string, value: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.selectOption(value);
  }

  /**
   * チェックボックスをチェック
   */
  async check(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.check();
  }

  /**
   * チェックボックスのチェックを外す
   */
  async uncheck(selector: string): Promise<void> {
    const element = await this.waitForElement(selector);
    await element.uncheck();
  }

  /**
   * キーボードのキーを押す
   */
  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  /**
   * ページの読み込みを待つ
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 指定時間待機
   */
  async wait(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  /**
   * エラーメッセージを取得
   */
  async getErrorMessage(): Promise<string | null> {
    const errorSelectors = [
      '.error-message',
      '.text-red-500',
      '[role="alert"]',
      '.alert-danger',
      '.error',
      '.validation-error'
    ];

    for (const selector of errorSelectors) {
      if (await this.isElementVisible(selector)) {
        return await this.getElementText(selector);
      }
    }
    return null;
  }

  /**
   * 成功メッセージを取得
   */
  async getSuccessMessage(): Promise<string | null> {
    const successSelectors = [
      '.success-message',
      '.text-green-500',
      '.alert-success',
      '.success',
      '.toast-success'
    ];

    for (const selector of successSelectors) {
      if (await this.isElementVisible(selector)) {
        return await this.getElementText(selector);
      }
    }
    return null;
  }

  /**
   * ローディング状態が終わるまで待つ
   */
  async waitForLoadingToComplete(): Promise<void> {
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[aria-busy="true"]',
      '.skeleton',
      '.shimmer'
    ];

    for (const selector of loadingSelectors) {
      if (await this.isElementVisible(selector)) {
        await this.waitForElementToDisappear(selector, 30000);
      }
    }
  }
}
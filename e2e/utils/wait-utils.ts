/**
 * E2Eテスト用待機ユーティリティ
 * 認証状態やページ遷移を確実に処理
 */

import { Page } from '@playwright/test';

export class WaitUtils {
  /**
   * 認証状態が確立されるまで待機
   * 複数の認証指標を並行チェック
   */
  static async waitForAuthentication(page: Page): Promise<void> {
    try {
      // 複数の認証指標を並行で確認
      await Promise.all([
        // Supabase認証Cookieの確認
        page.waitForFunction(() => {
          const cookies = document.cookie;
          return cookies.includes('sb-') || 
                 cookies.includes('auth-token') ||
                 cookies.includes('access-token');
        }, { timeout: 5000 }).catch(() => {}), // エラーを無視
        
        // LocalStorageの確認（Supabaseセッション）
        page.waitForFunction(() => {
          try {
            const authToken = localStorage.getItem('supabase.auth.token');
            const authSession = localStorage.getItem('sb-auth-token');
            return authToken !== null || authSession !== null;
          } catch {
            return false;
          }
        }, { timeout: 5000 }).catch(() => {}), // エラーを無視
        
        // ネットワークの安定を待つ
        page.waitForLoadState('networkidle').catch(() => {})
      ]);
      
      // 追加の安定化待機（DOMの更新を待つ）
      await page.waitForTimeout(500);
    } catch (error) {
      console.warn('Authentication wait warning:', error);
      // エラーが発生しても処理を継続
    }
  }
  
  /**
   * ページ遷移を確実に待機
   */
  static async waitForPageTransition(
    page: Page, 
    urlPattern: string | RegExp,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout || 10000;
    
    // URLパターンを正規化
    const normalizedPattern = typeof urlPattern === 'string' 
      ? new RegExp(urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : urlPattern;
    
    try {
      // 複数の方法で遷移を確認
      await Promise.race([
        // Playwrightの標準的な方法
        page.waitForURL(urlPattern, { timeout }),
        
        // JavaScriptでの確認（フォールバック）
        page.waitForFunction(
          (pattern: string) => {
            const regex = new RegExp(pattern);
            return regex.test(window.location.href);
          },
          normalizedPattern.source,
          { timeout }
        )
      ]);
      
      // ページが完全に読み込まれるまで待機
      await page.waitForLoadState('domcontentloaded');
    } catch (error) {
      // 現在のURLをログ出力して問題を診断
      const currentUrl = page.url();
      console.error(`Failed to navigate to ${urlPattern}. Current URL: ${currentUrl}`);
      throw error;
    }
  }
  
  /**
   * 要素が安定して操作可能になるまで待機
   */
  static async waitForElementStable(
    page: Page,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    const timeout = options?.timeout || 10000;
    
    // 要素が存在し、表示され、有効になるまで待機
    await page.waitForSelector(selector, { 
      state: 'visible',
      timeout 
    });
    
    // 要素が安定するまで待機（位置が変わらない）
    await page.waitForFunction(
      (sel: string) => {
        const element = document.querySelector(sel);
        if (!element) return false;
        
        const rect1 = element.getBoundingClientRect();
        return new Promise(resolve => {
          setTimeout(() => {
            const rect2 = element.getBoundingClientRect();
            resolve(
              rect1.top === rect2.top && 
              rect1.left === rect2.left
            );
          }, 100);
        });
      },
      selector,
      { timeout: 5000 }
    ).catch(() => {}); // エラーを無視
    
    // 追加の安定化待機
    await page.waitForTimeout(200);
  }
  
  /**
   * APIレスポンスを待機
   */
  static async waitForApiResponse(
    page: Page,
    urlPattern: string | RegExp,
    options?: { timeout?: number; method?: string }
  ): Promise<void> {
    const timeout = options?.timeout || 10000;
    const method = options?.method || 'GET';
    
    await page.waitForResponse(
      response => {
        const matchesUrl = typeof urlPattern === 'string'
          ? response.url().includes(urlPattern)
          : urlPattern.test(response.url());
        
        const matchesMethod = response.request().method() === method;
        const isSuccess = response.status() >= 200 && response.status() < 300;
        
        return matchesUrl && matchesMethod && isSuccess;
      },
      { timeout }
    );
  }
  
  /**
   * ファイルアップロードの準備が整うまで待機
   */
  static async waitForUploadReady(page: Page): Promise<void> {
    // ファイル入力が利用可能になるまで待機
    await page.waitForSelector('input[type="file"]', { 
      state: 'attached',
      timeout: 10000 
    });
    
    // アップロードボタンが有効になるまで待機（存在する場合）
    const uploadButton = page.locator('button:has-text("アップロード")');
    if (await uploadButton.count() > 0) {
      await uploadButton.waitFor({ state: 'visible' });
      
      // ボタンが有効になるまで待機
      await page.waitForFunction(
        () => {
          const button = document.querySelector('button:has-text("アップロード")') as HTMLButtonElement;
          return button && !button.disabled;
        },
        { timeout: 5000 }
      ).catch(() => {});
    }
  }
  
  /**
   * セッションが確立されているか確認
   */
  static async isAuthenticated(page: Page): Promise<boolean> {
    try {
      const hasAuthCookie = await page.evaluate(() => {
        const cookies = document.cookie;
        return cookies.includes('sb-') || 
               cookies.includes('auth-token');
      });
      
      const hasAuthStorage = await page.evaluate(() => {
        try {
          const authToken = localStorage.getItem('supabase.auth.token');
          const authSession = localStorage.getItem('sb-auth-token');
          return authToken !== null || authSession !== null;
        } catch {
          return false;
        }
      });
      
      return hasAuthCookie || hasAuthStorage;
    } catch {
      return false;
    }
  }
  
  /**
   * リトライ付き待機
   */
  static async waitWithRetry<T>(
    fn: () => Promise<T>,
    options?: { retries?: number; delay?: number }
  ): Promise<T> {
    const maxRetries = options?.retries || 3;
    const delay = options?.delay || 1000;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Max retries exceeded');
  }
}
/**
 * 認証済みページを提供するテストフィクスチャ
 */

import { test as base, Page } from '@playwright/test';
import { Config } from '../config';

// ページタイプの定義
type AuthenticatedPage = Page;
type AdminAuthenticatedPage = Page;

// フィクスチャの型定義
type AuthFixtures = {
  authenticatedPage: AuthenticatedPage;
  adminAuthenticatedPage: AdminAuthenticatedPage;
  freshAuthenticatedPage: AuthenticatedPage;
};

/**
 * 認証拡張テスト
 */
export const test = base.extend<AuthFixtures>({
  /**
   * 一般ユーザーとして認証済みのページ
   */
  authenticatedPage: async ({ page }, use) => {
    // ログイン処理
    await Config.login(page);
    
    // 認証済みページを提供
    await use(page);
    
    // クリーンアップ（オプション）
    // await Config.logout(page);
  },
  
  /**
   * 管理者として認証済みのページ
   */
  adminAuthenticatedPage: async ({ page }, use) => {
    // 管理者としてログイン
    const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'adminpass123';
    
    await Config.login(page, adminEmail, adminPassword);
    
    // 管理者権限の確認
    await page.waitForSelector(Config.selectors.dashboard.adminLink, {
      timeout: Config.timeouts.element
    });
    
    // 認証済みページを提供
    await use(page);
  },
  
  /**
   * 毎回新しいコンテキストで認証するページ
   * セッション分離が必要なテスト用
   */
  freshAuthenticatedPage: async ({ browser }, use) => {
    // 新しいコンテキストを作成
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // ログイン処理
    await Config.login(page);
    
    // 認証済みページを提供
    await use(page);
    
    // クリーンアップ
    await context.close();
  },
});

// re-export expect for convenience
export { expect } from '@playwright/test';
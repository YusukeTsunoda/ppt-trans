import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * 管理者機能のアクセス制御テスト
 * - 管理者のみアクセス可能な機能の検証
 * - 一般ユーザーとの権限分離確認
 */
test.describe('管理者アクセス制御', () => {
  
  test.describe('管理者ユーザーのアクセス', () => {
    test.use({
      storageState: { cookies: [], origins: [] }
    });

    test.beforeEach(async ({ page, baseURL }) => {
      // 管理者アカウントでログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    });

    test('管理者ダッシュボードへのアクセス', async ({ page, baseURL }) => {
      // 管理者ダッシュボードへ遷移
      await page.goto(`${baseURL}/admin`);
      
      // アクセス可能であることを確認
      await expect(page).toHaveURL(/\/admin/);
      await expect(page.locator('h1')).toContainText('管理者ダッシュボード');
      
      // 管理者機能の要素が表示されることを確認
      await expect(page.locator('text=統計情報')).toBeVisible();
      await expect(page.locator('text=ユーザー管理')).toBeVisible();
      await expect(page.locator('text=アクティビティログ')).toBeVisible();
    });

    test('管理者メニューの表示', async ({ page }) => {
      // ユーザーメニューボタンをクリック
      await page.click('[data-testid="user-menu-button"]');
      
      // 管理者専用メニューが表示されることを確認
      await expect(page.locator('text=🛠️ 管理画面')).toBeVisible();
      await expect(page.locator('text=📊 統計ダッシュボード')).toBeVisible();
    });

    test('ユーザー管理機能', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/admin`);
      
      // ユーザー管理タブをクリック
      await page.click('button:has-text("ユーザー管理")');
      
      // ユーザーリストが表示されることを確認
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('th:has-text("ユーザー")')).toBeVisible();
      await expect(page.locator('th:has-text("ロール")')).toBeVisible();
      await expect(page.locator('th:has-text("ステータス")')).toBeVisible();
      
      // ユーザーのロールが表示されることを確認
      const adminBadge = page.locator('span:has-text("admin")').first();
      await expect(adminBadge).toBeVisible();
    });

    test('アクティビティログの閲覧', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/admin`);
      
      // アクティビティログタブをクリック
      await page.click('button:has-text("アクティビティログ")');
      
      // ログエントリが表示されることを確認
      await expect(page.locator('text=最近のアクティビティ')).toBeVisible();
      
      // ログインアクションが記録されていることを確認
      const loginLog = page.locator('text=ログイン').first();
      await expect(loginLog).toBeVisible({ timeout: 5000 });
    });

    test('統計情報の表示', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/admin`);
      
      // 統計情報タブがデフォルトで選択されていることを確認
      await expect(page.locator('button:has-text("統計情報")')).toHaveClass(/border-primary/);
      
      // 統計カードが表示されることを確認
      await expect(page.locator('text=総ユーザー数')).toBeVisible();
      await expect(page.locator('text=アクティブユーザー')).toBeVisible();
      await expect(page.locator('text=総ファイル数')).toBeVisible();
      await expect(page.locator('text=総翻訳数')).toBeVisible();
    });
  });

  test.describe('一般ユーザーのアクセス制限', () => {
    test.use({
      storageState: { cookies: [], origins: [] }
    });

    test.beforeEach(async ({ page, baseURL }) => {
      // 一般ユーザーアカウントでログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    });

    test('管理者ダッシュボードへのアクセス拒否', async ({ page, baseURL }) => {
      // 管理者ダッシュボードへ直接アクセス試行
      await page.goto(`${baseURL}/admin`);
      
      // ダッシュボードにリダイレクトされることを確認
      await expect(page).toHaveURL(/\/dashboard/);
      
      // 管理者ダッシュボードが表示されないことを確認
      await expect(page.locator('h1')).not.toContainText('管理者ダッシュボード');
    });

    test('管理者メニューの非表示', async ({ page }) => {
      // ユーザーメニューボタンをクリック
      await page.click('[data-testid="user-menu-button"]');
      
      // 管理者専用メニューが表示されないことを確認
      await expect(page.locator('text=🛠️ 管理画面')).not.toBeVisible();
      await expect(page.locator('text=📊 統計ダッシュボード')).not.toBeVisible();
      
      // 一般ユーザー向けメニューのみ表示されることを確認
      await expect(page.locator('text=プロフィール')).toBeVisible();
      await expect(page.locator('text=設定')).toBeVisible();
      await expect(page.locator('text=ログアウト')).toBeVisible();
    });

    test('URLパラメータ操作による不正アクセス防止', async ({ page, baseURL }) => {
      // 管理者APIエンドポイントへの直接アクセス試行
      const response = await page.request.get(`${baseURL}/api/admin/stats`);
      
      // 403 Forbiddenまたは401 Unauthorizedが返されることを確認
      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('ロール昇格攻撃の防止', () => {
    test('クライアントサイドでのロール変更試行', async ({ page, baseURL }) => {
      // 一般ユーザーでログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // LocalStorageやSessionStorageを操作してロールを変更
      await page.evaluate(() => {
        localStorage.setItem('userRole', 'admin');
        sessionStorage.setItem('role', 'admin');
      });
      
      // ページをリロード
      await page.reload();
      
      // 管理者ダッシュボードへアクセス試行
      await page.goto(`${baseURL}/admin`);
      
      // アクセスが拒否されることを確認
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('APIリクエストヘッダーでのロール偽装', async ({ page, baseURL }) => {
      // 一般ユーザーでログイン後、管理者権限を要求するAPIを呼び出し
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // カスタムヘッダーで管理者権限を偽装
      const response = await page.request.get(`${baseURL}/api/admin/users`, {
        headers: {
          'X-User-Role': 'admin',
          'X-Admin-Token': 'fake-admin-token'
        }
      });
      
      // リクエストが拒否されることを確認
      expect([401, 403]).toContain(response.status());
    });
  });
});
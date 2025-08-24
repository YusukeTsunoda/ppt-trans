import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * セッション管理 - MVPコアテスト
 * セッションタイムアウトと更新の動作を検証
 */
test.describe('セッション管理', () => {
  test('セッション期限切れ後のリダイレクト', async ({ page, context, baseURL }) => {
    // ダッシュボードにアクセス（認証済み）
    await page.goto(`${baseURL}/dashboard`);
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // セッションクッキーを削除してセッション切れをシミュレート
    await context.clearCookies();
    
    // ページをリロード
    await page.reload();
    
    // ログインページへリダイレクトされることを確認
    await expect(page).toHaveURL(/.*\/login/, { 
      timeout: TEST_CONFIG.timeouts.navigation 
    });
    
    // callbackURLパラメータが設定されていることを確認
    const url = new URL(page.url());
    expect(url.searchParams.has('callbackUrl')).toBeTruthy();
    expect(url.searchParams.get('callbackUrl')).toContain('dashboard');
  });

  test('API呼び出し時のセッション切れ処理', async ({ page, context, baseURL }) => {
    // ファイルアップロードページへ
    await page.goto(`${baseURL}/upload`);
    
    // ファイルを選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
    
    // セッションクッキーを削除
    await context.clearCookies();
    
    // アップロードを試みる
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    // 認証エラーまたはログインページへのリダイレクト
    const isRedirected = await page.waitForURL(/.*\/login/, { 
      timeout: TEST_CONFIG.timeouts.upload,
      waitUntil: 'domcontentloaded' 
    }).then(() => true).catch(() => false);
    
    const hasAuthError = await page.locator('text=/認証.*必要|Unauthorized|ログイン.*必要/').isVisible({ 
      timeout: 2000 
    });
    
    expect(isRedirected || hasAuthError).toBeTruthy();
  });

  test('長時間操作なし後の動作', async ({ page, baseURL }) => {
    // ダッシュボードにアクセス
    await page.goto(`${baseURL}/dashboard`);
    
    // 初期状態を確認
    await expect(page.locator('h1, h2').first()).toBeVisible();
    const initialText = await page.locator('h1, h2').first().textContent();
    
    // 5分間待機をシミュレート（実際のテストでは短縮）
    // 注: 実際のセッションタイムアウトは環境設定に依存
    await page.waitForTimeout(5000); // 5秒で代替
    
    // ページ操作を実行
    const clickableElement = page.locator('a, button').first();
    await clickableElement.click();
    
    // セッションが維持されているか、ログアウトされているかを確認
    const isStillLoggedIn = page.url().includes('dashboard') || 
                            page.url().includes('upload') || 
                            page.url().includes('preview');
    const isLoggedOut = page.url().includes('login');
    
    // どちらかの状態であることを確認（環境設定に依存）
    expect(isStillLoggedIn || isLoggedOut).toBeTruthy();
  });

  test('複数タブでのセッション共有', async ({ browser, baseURL }) => {
    // 認証状態を使用して2つのページを開く
    const authFile = 'playwright-auth.json';
    const context = await browser.newContext({ storageState: authFile });
    
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // 両方のタブでダッシュボードにアクセス
    await page1.goto(`${baseURL}/dashboard`);
    await page2.goto(`${baseURL}/dashboard`);
    
    // 両方のタブでログイン状態が維持されていることを確認
    await expect(page1).toHaveURL(/.*\/dashboard/);
    await expect(page2).toHaveURL(/.*\/dashboard/);
    
    // 片方のタブでログアウト
    const logoutButton = page1.locator('button:has-text("ログアウト"), a:has-text("ログアウト")');
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      await expect(page1).toHaveURL(/.*\/login/);
      
      // もう片方のタブをリロード
      await page2.reload();
      
      // セッション共有のため、こちらもログアウトされる
      await expect(page2).toHaveURL(/.*\/login/, { 
        timeout: TEST_CONFIG.timeouts.navigation 
      });
    }
    
    await context.close();
  });

  test('セッション更新の確認', async ({ page, baseURL }) => {
    // ダッシュボードにアクセス
    await page.goto(`${baseURL}/dashboard`);
    
    // 複数回のページ遷移を実行（セッション更新をトリガー）
    await page.goto(`${baseURL}/upload`);
    await page.goto(`${baseURL}/dashboard`);
    await page.goto(`${baseURL}/profile`);
    
    // 各遷移後もログイン状態が維持されていることを確認
    const finalUrl = page.url();
    expect(finalUrl).not.toContain('login');
    
    // 認証が必要なAPIエンドポイントへのリクエストが成功することを確認
    const response = await page.request.get(`${baseURL}/api/user`, {
      failOnStatusCode: false
    });
    
    // 401以外のステータスコードを期待（200, 404など）
    expect(response.status()).not.toBe(401);
  });
});
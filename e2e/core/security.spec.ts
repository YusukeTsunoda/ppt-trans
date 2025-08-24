import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';

/**
 * セキュリティ - MVPコアテスト
 * アプリケーションのセキュリティ要件を検証
 */
test.describe('セキュリティ', () => {
  test('未認証アクセスの防止', async ({ page, baseURL }) => {
    // 保護されたルートへの直接アクセス
    const protectedRoutes = [
      '/dashboard',
      '/upload',
      '/preview/test-id',
      '/profile',
      '/settings'
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${baseURL}${route}`);
      
      // ログインページへリダイレクトされることを確認
      await expect(page).toHaveURL(/.*\/login/, { 
        timeout: TEST_CONFIG.timeouts.navigation 
      });
      
      // callbackURLが設定されていることを確認
      const url = new URL(page.url());
      expect(url.searchParams.has('callbackUrl')).toBeTruthy();
    }
  });

  test('CSRF保護の確認', async ({ page, baseURL }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    // CSRFトークンがフォームに含まれているか確認
    const csrfToken = await page.locator('input[name="csrfToken"], meta[name="csrf-token"]');
    const tokenCount = await csrfToken.count();
    
    // CSRFトークンが存在する場合の確認（実装依存）
    if (tokenCount > 0) {
      const tokenValue = await csrfToken.first().getAttribute('value') || 
                        await csrfToken.first().getAttribute('content');
      expect(tokenValue).toBeTruthy();
      if (tokenValue) {
        expect(tokenValue.length).toBeGreaterThan(20);
      }
    }
  });

  test('SQLインジェクション防止', async ({ page, baseURL }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    // 悪意のある入力パターン
    const maliciousInputs = [
      "admin'--",
      "' OR '1'='1",
      "'; DROP TABLE users;--",
      "admin' /*",
      "' UNION SELECT * FROM users--"
    ];
    
    for (const input of maliciousInputs) {
      await loginPage.fillEmail(input);
      await loginPage.fillPassword('password');
      await loginPage.submit();
      
      // エラーメッセージが安全に表示される（SQLエラーを露出しない）
      const errorMessage = page.locator('.bg-red-50, [role="alert"], .error-message');
      if (await errorMessage.first().isVisible({ timeout: 2000 })) {
        const errorText = await errorMessage.first().textContent();
        
        // SQLエラーの詳細が露出していないことを確認
        expect(errorText).not.toContain('SQL');
        expect(errorText).not.toContain('syntax');
        expect(errorText).not.toContain('database');
        expect(errorText).not.toContain('table');
      }
      
      // ページが正常に動作していることを確認
      await expect(page).toHaveURL(/.*\/login/);
    }
  });

  test('XSS攻撃防止', async ({ page, baseURL }) => {
    // まずログイン
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsStandardUser();
    await loginPage.expectLoginSuccess();
    
    // アップロードページへ
    await page.goto(`${baseURL}/upload`);
    
    // XSSペイロードを含むファイル名のテスト
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>'
    ];
    
    // ファイル名にXSSペイロードを含むテスト用ファイルを作成
    // 注: 実際のファイルアップロードはモックまたは安全なテストファイルを使用
    
    // プロフィールページでのXSSテスト
    await page.goto(`${baseURL}/profile`);
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    
    if (await nameInput.isVisible({ timeout: 2000 })) {
      for (const payload of xssPayloads) {
        await nameInput.clear();
        await nameInput.fill(payload);
        
        const saveButton = page.locator('button:has-text("保存"), button:has-text("更新")');
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
        
        // アラートが表示されないことを確認
        page.on('dialog', dialog => {
          // XSSが成功した場合、テストを失敗させる
          throw new Error(`XSS vulnerability detected: ${dialog.message()}`);
        });
        
        await page.waitForTimeout(1000);
        
        // 入力がサニタイズされて表示されることを確認
        const displayedName = await nameInput.inputValue();
        expect(displayedName).not.toContain('<script>');
        expect(displayedName).not.toContain('javascript:');
      }
    }
  });

  test('セッションセキュリティ', async ({ page, browser, baseURL }) => {
    // 最初のコンテキストでログイン
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const loginPage1 = new LoginPage(page1);
    
    await loginPage1.navigate();
    await loginPage1.loginAsStandardUser();
    await loginPage1.expectLoginSuccess();
    
    // セッションクッキーを取得
    const cookies = await context1.cookies();
    const sessionCookie = cookies.find(c => c.name.includes('auth') || c.name.includes('session'));
    
    if (sessionCookie) {
      // HttpOnlyフラグが設定されていることを確認
      expect(sessionCookie.httpOnly).toBeTruthy();
      
      // Secureフラグが設定されていることを確認（本番環境）
      if (baseURL && baseURL.startsWith('https://')) {
        expect(sessionCookie.secure).toBeTruthy();
      }
      
      // SameSite属性が設定されていることを確認
      expect(sessionCookie.sameSite).toBeTruthy();
    }
    
    // ログアウト
    const logoutButton = page1.locator('button:has-text("ログアウト")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
    
    // ログアウト後、保護されたページにアクセスできないことを確認
    await page1.goto(`${baseURL}/dashboard`);
    await expect(page1).toHaveURL(/.*\/login/);
    
    await context1.close();
  });

  test.skip('ファイルアクセス権限の検証', async ({ page, browser, baseURL }) => {
    // TODO: 異なるユーザーでのテストのため、認証フローの修正が必要
    // ユーザー1でログインしてファイルをアップロード
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    const loginPage1 = new LoginPage(page1);
    
    await loginPage1.navigate();
    await loginPage1.login('user1@example.com', 'Test123!');
    
    // ファイルをアップロード（実装に応じて調整）
    await page1.goto(`${baseURL}/upload`);
    // ... アップロード処理
    
    // ファイルIDを取得（URLから）
    await page1.goto(`${baseURL}/dashboard`);
    const fileLink = page1.locator('a[href*="/preview/"]').first();
    let fileId = '';
    
    if (await fileLink.isVisible({ timeout: 2000 })) {
      const href = await fileLink.getAttribute('href');
      if (href) {
        const match = href.match(/preview\/([^/]+)/);
        fileId = match ? match[1] : '';
      }
    }
    
    await context1.close();
    
    // ユーザー2でログイン
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const loginPage2 = new LoginPage(page2);
    
    await loginPage2.navigate();
    await loginPage2.login('user2@example.com', 'Test123!');
    
    if (fileId) {
      // ユーザー1のファイルにアクセス試行
      await page2.goto(`${baseURL}/preview/${fileId}`);
      
      // アクセス拒否されることを確認
      const errorMessage = page2.locator('text=/アクセス権限がありません|Forbidden|403|Not authorized/');
      await expect(errorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    }
    
    await context2.close();
  });

  test('レート制限の確認', async ({ page, baseURL }) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    
    // 短時間に複数回ログイン試行
    for (let i = 0; i < 10; i++) {
      await loginPage.fillEmail(`test${i}@example.com`);
      await loginPage.fillPassword('wrongpassword');
      await loginPage.submit();
      
      // レート制限メッセージが表示されるか確認
      if (i > 5) {
        const rateLimitMessage = page.locator('text=/Too many attempts|試行回数が多すぎます|しばらく待って/');
        if (await rateLimitMessage.isVisible({ timeout: 1000 })) {
          // レート制限が機能していることを確認
          expect(await rateLimitMessage.textContent()).toBeTruthy();
          break;
        }
      }
      
      await page.waitForTimeout(100);
    }
  });

  test('パスワード要件の強制', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/register`);
    
    // 弱いパスワードのパターン
    const weakPasswords = [
      '123456',           // 数字のみ
      'password',         // 辞書単語
      'abc',              // 短すぎる
      'ABCDEFGH',         // 大文字のみ
      'abcdefgh',         // 小文字のみ
      '12345678',         // 数字のみ（8文字）
    ];
    
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const confirmInput = page.locator('input[name="confirmPassword"]').first();
    
    for (const weakPassword of weakPasswords) {
      await passwordInput.fill(weakPassword);
      await confirmInput.fill(weakPassword);
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // パスワード要件エラーが表示されることを確認
      const errorMessage = page.locator('text=/パスワードは.*文字以上|Password must|強度が不十分/');
      await expect(errorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
    }
    
    // 強いパスワードの例
    const strongPassword = 'Test123!@#';
    await passwordInput.fill(strongPassword);
    await confirmInput.fill(strongPassword);
    
    // エラーが表示されないことを確認（他の必須フィールドを埋めていない場合を除く）
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('newuser@example.com');
    
    await page.locator('button[type="submit"]').click();
    
    // パスワードエラーが表示されないことを確認
    const passwordError = page.locator('text=/パスワードは.*文字以上|Password must/');
    await expect(passwordError).not.toBeVisible({ timeout: 1000 });
  });
});
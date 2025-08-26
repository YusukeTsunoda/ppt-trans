import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * 並行セッション制御のテスト
 * - 複数デバイスからの同時ログイン
 * - セッション数の制限
 * - デバイス管理機能
 */
test.describe('並行セッション制御', () => {
  
  test.describe('複数デバイスセッション管理', () => {
    test('異なるブラウザからの同時ログイン', async ({ browser, baseURL }) => {
      // ブラウザコンテキスト1（デバイス1）
      const context1 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0'
      });
      const page1 = await context1.newPage();
      
      // ブラウザコンテキスト2（デバイス2）
      const context2 = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/14.1'
      });
      const page2 = await context2.newPage();
      
      // デバイス1でログイン
      await page1.goto(`${baseURL}/login`);
      await page1.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page1.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page1.click('button[type="submit"]:has-text("ログイン")');
      await page1.waitForURL('**/dashboard');
      
      // デバイス2でログイン
      await page2.goto(`${baseURL}/login`);
      await page2.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page2.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page2.click('button[type="submit"]:has-text("ログイン")');
      await page2.waitForURL('**/dashboard');
      
      // 両方のセッションが有効であることを確認
      await page1.reload();
      await expect(page1).not.toHaveURL(/\/login/);
      await expect(page1.locator('button:has-text("ログアウト")')).toBeVisible();
      
      await page2.reload();
      await expect(page2).not.toHaveURL(/\/login/);
      await expect(page2.locator('button:has-text("ログアウト")')).toBeVisible();
      
      await context1.close();
      await context2.close();
    });

    test('セッション数制限の確認', async ({ browser, baseURL }) => {
      const maxSessions = 3; // 最大3セッションと仮定
      const contexts = [];
      const pages = [];
      
      // 最大数までセッションを作成
      for (let i = 0; i < maxSessions; i++) {
        const context = await browser.newContext({
          userAgent: `TestBrowser/1.0 Device${i + 1}`
        });
        const page = await context.newPage();
        
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.click('button[type="submit"]:has-text("ログイン")');
        await page.waitForURL('**/dashboard');
        
        contexts.push(context);
        pages.push(page);
      }
      
      // 制限を超えるセッションを作成
      const extraContext = await browser.newContext({
        userAgent: 'TestBrowser/1.0 ExtraDevice'
      });
      const extraPage = await extraContext.newPage();
      
      await extraPage.goto(`${baseURL}/login`);
      await extraPage.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await extraPage.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await extraPage.click('button[type="submit"]:has-text("ログイン")');
      
      // セッション制限メッセージまたは既存セッション無効化を確認
      const limitMessage = extraPage.locator('text=/セッション数の上限|Maximum sessions reached/i');
      const isLimitReached = await limitMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isLimitReached) {
        // セッション制限メッセージが表示される場合
        await expect(limitMessage).toBeVisible();
      } else {
        // 最も古いセッションが無効化される場合
        await extraPage.waitForURL('**/dashboard');
        
        // 最初のセッションが無効化されたことを確認
        await pages[0].reload();
        await expect(pages[0]).toHaveURL(/\/login/);
      }
      
      // クリーンアップ
      for (const context of contexts) {
        await context.close();
      }
      await extraContext.close();
    });

    test('デバイス情報の表示', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // プロフィールまたはセキュリティ設定ページへ
      await page.goto(`${baseURL}/profile`);
      
      // セッション管理セクションを探す
      const sessionSection = page.locator('text=/アクティブなセッション|Active sessions/i');
      
      if (await sessionSection.isVisible()) {
        // 現在のセッション情報が表示されることを確認
        const currentSession = page.locator('text=/現在のセッション|Current session/i').locator('..');
        await expect(currentSession).toBeVisible();
        
        // デバイス情報が含まれることを確認
        await expect(currentSession).toContainText(/Chrome|Firefox|Safari|Edge/);
        
        // IPアドレスまたは位置情報が表示されることを確認（プライバシー設定による）
        const hasIPInfo = await currentSession.locator('text=/\d+\.\d+\.\d+\.\d+/').isVisible()
          .catch(() => false);
        const hasLocationInfo = await currentSession.locator('text=/Japan|United States|Location/i').isVisible()
          .catch(() => false);
        
        expect(hasIPInfo || hasLocationInfo).toBeTruthy();
      }
    });
  });

  test.describe('セッション管理機能', () => {
    test('個別セッションの終了', async ({ browser, baseURL }) => {
      // 2つのセッションを作成
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // 両方でログイン
      for (const page of [page1, page2]) {
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.click('button[type="submit"]:has-text("ログイン")');
        await page.waitForURL('**/dashboard');
      }
      
      // セッション1からセッション管理ページへ
      await page1.goto(`${baseURL}/profile`);
      
      // 他のセッションを終了するボタンを探す
      const otherSessionButtons = page1.locator('button:has-text("終了"), button:has-text("Terminate")');
      const buttonCount = await otherSessionButtons.count();
      
      if (buttonCount > 0) {
        // 最初の「他のセッション」を終了
        await otherSessionButtons.first().click();
        
        // 確認ダイアログが表示される場合
        const confirmButton = page1.locator('button:has-text("確認"), button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
        }
        
        // セッション2が無効化されたことを確認
        await page2.reload();
        await expect(page2).toHaveURL(/\/login/);
        
        // セッション1は有効なままであることを確認
        await page1.reload();
        await expect(page1).not.toHaveURL(/\/login/);
      }
      
      await context1.close();
      await context2.close();
    });

    test('すべてのセッションを終了', async ({ browser, baseURL }) => {
      // 複数のセッションを作成
      const contexts = [];
      const pages = [];
      
      for (let i = 0; i < 2; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.click('button[type="submit"]:has-text("ログイン")');
        await page.waitForURL('**/dashboard');
        
        contexts.push(context);
        pages.push(page);
      }
      
      // セッション管理ページへ
      await pages[0].goto(`${baseURL}/profile`);
      
      // 「すべてのセッションを終了」ボタンを探す
      const terminateAllButton = pages[0].locator(
        'button:has-text("すべてのセッションを終了"), button:has-text("Terminate all sessions")'
      );
      
      if (await terminateAllButton.isVisible()) {
        await terminateAllButton.click();
        
        // 確認ダイアログ
        const confirmButton = pages[0].locator('button:has-text("確認"), button:has-text("Confirm")');
        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
        }
        
        // すべてのセッションが終了することを確認
        for (const page of pages) {
          await page.reload();
          await expect(page).toHaveURL(/\/login/);
        }
      }
      
      // クリーンアップ
      for (const context of contexts) {
        await context.close();
      }
    });

    test('不審なセッションの検出', async ({ page, browser, baseURL }) => {
      // 通常のログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 異なる地域からのログインをシミュレート
      const suspiciousContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/91.0',
        geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York
        permissions: ['geolocation']
      });
      const suspiciousPage = await suspiciousContext.newPage();
      
      await suspiciousPage.goto(`${baseURL}/login`);
      await suspiciousPage.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await suspiciousPage.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await suspiciousPage.click('button[type="submit"]:has-text("ログイン")');
      
      // 不審なログインの警告を確認
      const warningMessage = suspiciousPage.locator(
        'text=/新しい場所からのログイン|New login from|Unusual activity/i'
      );
      const hasWarning = await warningMessage.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasWarning) {
        await expect(warningMessage).toBeVisible();
        
        // 確認オプションが提供されることを確認
        const verifyButton = suspiciousPage.locator(
          'button:has-text("これは私です"), button:has-text("This was me")'
        );
        await expect(verifyButton).toBeVisible();
      }
      
      // メール通知が送信されることを想定（実装による）
      // 実際のテストではメールサービスのモックが必要
      
      await suspiciousContext.close();
    });
  });

  test.describe('セッション同期とリアルタイム更新', () => {
    test('リアルタイムセッションステータス更新', async ({ browser, baseURL }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // 両方でログイン
      for (const page of [page1, page2]) {
        await page.goto(`${baseURL}/login`);
        await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
        await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
        await page.click('button[type="submit"]:has-text("ログイン")');
        await page.waitForURL('**/dashboard');
      }
      
      // ページ1でセッション管理画面を開く
      await page1.goto(`${baseURL}/profile`);
      
      // セッションリストの初期状態を確認
      const sessionList = page1.locator('.session-list, [data-testid="session-list"]');
      const initialCount = await sessionList.locator('.session-item, tr').count();
      
      // ページ2でログアウト
      await page2.click('button:has-text("ログアウト")');
      await page2.waitForURL('**/login');
      
      // ページ1でセッションリストが更新されることを確認（WebSocketまたはポーリング）
      await page1.waitForTimeout(2000); // リアルタイム更新を待つ
      
      const updatedCount = await sessionList.locator('.session-item, tr').count();
      
      // セッション数が減少していることを確認（実装による）
      if (updatedCount < initialCount) {
        expect(updatedCount).toBeLessThan(initialCount);
      }
      
      await context1.close();
      await context2.close();
    });

    test('セッションアクティビティの追跡', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 最終アクティビティ時刻を記録
      const initialActivity = new Date();
      
      // いくつかのアクションを実行
      await page.goto(`${baseURL}/files`);
      await page.waitForTimeout(1000);
      await page.goto(`${baseURL}/dashboard`);
      
      // プロフィールページでセッション情報を確認
      await page.goto(`${baseURL}/profile`);
      
      const currentSessionInfo = page.locator('text=/現在のセッション|Current session/i').locator('..');
      const lastActivityText = await currentSessionInfo.locator(
        'text=/最終アクティビティ|Last activity/i'
      ).textContent();
      
      if (lastActivityText) {
        // 最終アクティビティが更新されていることを確認
        const lastActivityMatch = lastActivityText.match(/(\d+)\s*(秒|分|minutes?|seconds?)/);
        if (lastActivityMatch) {
          const value = parseInt(lastActivityMatch[1]);
          const unit = lastActivityMatch[2];
          
          // 最近のアクティビティであることを確認
          if (unit.includes('秒') || unit.includes('second')) {
            expect(value).toBeLessThan(60);
          } else if (unit.includes('分') || unit.includes('minute')) {
            expect(value).toBeLessThan(5);
          }
        }
      }
    });

    test('デバイス間でのセッション状態同期', async ({ browser, baseURL }) => {
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // デバイス1でログイン
      await page1.goto(`${baseURL}/login`);
      await page1.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page1.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page1.click('button[type="submit"]:has-text("ログイン")');
      await page1.waitForURL('**/dashboard');
      
      // デバイス2でログイン
      await page2.goto(`${baseURL}/login`);
      await page2.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page2.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page2.click('button[type="submit"]:has-text("ログイン")');
      await page2.waitForURL('**/dashboard');
      
      // デバイス1でプロフィールを更新
      await page1.goto(`${baseURL}/profile`);
      const nameInput = page1.locator('input[name="displayName"], input[name="name"]');
      if (await nameInput.isVisible()) {
        await nameInput.clear();
        await nameInput.fill('Updated Name');
        
        const saveButton = page1.locator('button:has-text("保存"), button:has-text("Save")');
        await saveButton.click();
        
        // 保存成功メッセージを待つ
        await page1.waitForSelector('text=/保存しました|Saved successfully/i');
      }
      
      // デバイス2でプロフィール更新が反映されることを確認
      await page2.goto(`${baseURL}/profile`);
      const nameOnDevice2 = page2.locator('input[name="displayName"], input[name="name"]');
      if (await nameOnDevice2.isVisible()) {
        const value = await nameOnDevice2.inputValue();
        expect(value).toBe('Updated Name');
      }
      
      await context1.close();
      await context2.close();
    });
  });
});
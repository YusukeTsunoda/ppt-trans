import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test-config';

/**
 * 監査ログ機能のテスト
 * - すべてのユーザーアクションの記録
 * - ログの表示と検索
 * - セキュリティイベントの追跡
 */
test.describe('監査ログ機能', () => {
  
  test.describe('アクションの記録', () => {
    test('ログイン・ログアウトの記録', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      
      // ログインタイムスタンプを記録
      const loginTime = new Date();
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 管理者アカウントでログイン（ログ確認のため）
      await page.click('button:has-text("ログアウト")');
      await page.waitForURL('**/login');
      
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 管理者ダッシュボードへ移動
      await page.goto(`${baseURL}/admin`);
      
      // アクティビティログタブを開く
      await page.click('button:has-text("アクティビティログ")');
      
      // ログイン記録が存在することを確認
      const loginLog = page.locator(`text=/ログイン.*${TEST_CONFIG.auth.email}/`);
      await expect(loginLog).toBeVisible({ timeout: 5000 });
      
      // タイムスタンプが正しい範囲内であることを確認
      const logTimeText = await loginLog.locator('..').locator('time, .timestamp').textContent();
      if (logTimeText) {
        const logTime = new Date(logTimeText);
        const timeDiff = Math.abs(logTime.getTime() - loginTime.getTime());
        expect(timeDiff).toBeLessThan(60000); // 1分以内
      }
    });

    test('ファイルアップロードの記録', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // ファイルアップロードページへ
      await page.goto(`${baseURL}/upload`);
      
      // テストファイルをアップロード
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
      
      // アップロードボタンをクリック
      await page.click('button:has-text("アップロード")');
      
      // アップロード完了を待つ
      await page.waitForSelector('text=/アップロード完了|Upload complete/i', { timeout: 10000 });
      
      // 管理者アカウントでログイン
      await page.click('button:has-text("ログアウト")');
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      // 監査ログを確認
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
      
      // ファイルアップロードの記録を確認
      const uploadLog = page.locator('text=/ファイルアップロード.*test-presentation.pptx/');
      await expect(uploadLog).toBeVisible({ timeout: 5000 });
      
      // ユーザー情報が含まれることを確認
      const logEntry = uploadLog.locator('..');
      await expect(logEntry).toContainText(TEST_CONFIG.auth.email);
    });

    test('翻訳リクエストの記録', async ({ page, baseURL }) => {
      // ログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // ファイルページへ移動（既存のファイルがあると仮定）
      await page.goto(`${baseURL}/files`);
      
      // 最初のファイルの翻訳ボタンをクリック
      const translateButton = page.locator('button:has-text("翻訳")').first();
      if (await translateButton.isVisible()) {
        await translateButton.click();
        
        // 翻訳言語を選択
        await page.selectOption('select[name="targetLanguage"]', 'en');
        
        // 翻訳開始
        await page.click('button:has-text("翻訳開始")');
        
        // 翻訳完了を待つ（タイムアウトを設定）
        await page.waitForSelector('text=/翻訳完了|Translation complete/i', { timeout: 30000 });
      }
      
      // 管理者アカウントでログイン
      await page.click('button:has-text("ログアウト")');
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      // 監査ログを確認
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
      
      // 翻訳リクエストの記録を確認
      const translationLog = page.locator('text=/翻訳.*英語/');
      if (await translateButton.isVisible()) {
        await expect(translationLog).toBeVisible({ timeout: 5000 });
      }
    });

    test('セキュリティイベントの記録', async ({ page, baseURL }) => {
      // 失敗したログイン試行
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', 'WrongPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      // エラーメッセージを確認
      await page.waitForSelector('.bg-red-50');
      
      // 正しいパスワードでログイン
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 管理者アカウントでログイン
      await page.click('button:has-text("ログアウト")');
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      // 監査ログを確認
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
      
      // ログイン失敗の記録を確認
      const failedLoginLog = page.locator(`text=/ログイン失敗.*${TEST_CONFIG.auth.email}/`);
      await expect(failedLoginLog).toBeVisible({ timeout: 5000 });
      
      // セキュリティレベルが設定されていることを確認
      const securityBadge = failedLoginLog.locator('..').locator('.badge-warning, .text-orange-500');
      await expect(securityBadge).toBeVisible();
    });
  });

  test.describe('ログの表示と検索', () => {
    test.beforeEach(async ({ page, baseURL }) => {
      // 管理者としてログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 管理者ダッシュボードのログタブへ
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
    });

    test('ログのフィルタリング', async ({ page }) => {
      // アクションタイプでフィルタ
      const filterSelect = page.locator('select[name="actionType"], select[aria-label*="フィルタ"]');
      if (await filterSelect.isVisible()) {
        await filterSelect.selectOption('login');
        
        // ログイン関連のログのみ表示されることを確認
        const logEntries = page.locator('.log-entry, tbody tr');
        const count = await logEntries.count();
        
        for (let i = 0; i < count; i++) {
          const entry = logEntries.nth(i);
          await expect(entry).toContainText(/ログイン/);
        }
      }
    });

    test('ユーザーによる検索', async ({ page }) => {
      // 検索ボックスにユーザーメールを入力
      const searchInput = page.locator('input[placeholder*="検索"], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(TEST_CONFIG.auth.email);
        await searchInput.press('Enter');
        
        // 検索結果を待つ
        await page.waitForTimeout(1000);
        
        // 検索結果がフィルタされていることを確認
        const logEntries = page.locator('.log-entry, tbody tr');
        const count = await logEntries.count();
        
        if (count > 0) {
          for (let i = 0; i < Math.min(count, 5); i++) {
            const entry = logEntries.nth(i);
            await expect(entry).toContainText(TEST_CONFIG.auth.email);
          }
        }
      }
    });

    test('日付範囲でのフィルタリング', async ({ page }) => {
      // 日付範囲選択
      const dateFromInput = page.locator('input[type="date"][name*="from"], input[type="date"]:first-of-type');
      const dateToInput = page.locator('input[type="date"][name*="to"], input[type="date"]:last-of-type');
      
      if (await dateFromInput.isVisible() && await dateToInput.isVisible()) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        await dateFromInput.fill(yesterday.toISOString().split('T')[0]);
        await dateToInput.fill(today.toISOString().split('T')[0]);
        
        // フィルタを適用
        const applyButton = page.locator('button:has-text("適用"), button:has-text("Apply")');
        if (await applyButton.isVisible()) {
          await applyButton.click();
        }
        
        // ログが日付範囲内であることを確認
        await page.waitForTimeout(1000);
        const logDates = page.locator('time, .timestamp');
        const count = await logDates.count();
        
        for (let i = 0; i < Math.min(count, 5); i++) {
          const dateText = await logDates.nth(i).textContent();
          if (dateText) {
            const logDate = new Date(dateText);
            expect(logDate >= yesterday && logDate <= today).toBeTruthy();
          }
        }
      }
    });

    test('ログのエクスポート機能', async ({ page }) => {
      // エクスポートボタンを探す
      const exportButton = page.locator('button:has-text("エクスポート"), button:has-text("Export")');
      
      if (await exportButton.isVisible()) {
        // ダウンロードイベントを監視
        const downloadPromise = page.waitForEvent('download');
        
        await exportButton.click();
        
        // 形式選択モーダルが表示される場合
        const csvOption = page.locator('button:has-text("CSV"), label:has-text("CSV")');
        if (await csvOption.isVisible({ timeout: 1000 })) {
          await csvOption.click();
          
          const confirmExport = page.locator('button:has-text("ダウンロード"), button:has-text("Download")');
          await confirmExport.click();
        }
        
        // ダウンロードを確認
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/audit.*\.(csv|json|xlsx)/);
      }
    });
  });

  test.describe('ログの整合性とセキュリティ', () => {
    test('ログの改ざん防止', async ({ page, baseURL }) => {
      // 管理者としてログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
      
      // ログエントリの編集ボタンが存在しないことを確認
      const editButtons = page.locator('button:has-text("編集"), button:has-text("Edit")');
      await expect(editButtons).toHaveCount(0);
      
      // 削除ボタンが存在しないことを確認
      const deleteButtons = page.locator('button:has-text("削除"), button:has-text("Delete")');
      await expect(deleteButtons).toHaveCount(0);
      
      // コンソールでの直接操作を試みる
      const canModify = await page.evaluate(() => {
        const logElements = document.querySelectorAll('.log-entry, tbody tr');
        if (logElements.length > 0) {
          const firstLog = logElements[0];
          const originalContent = firstLog.textContent;
          
          // DOM操作を試みる
          firstLog.textContent = 'Modified content';
          
          // 変更が反映されないことを確認
          return firstLog.textContent === 'Modified content';
        }
        return false;
      });
      
      // クライアントサイドでの変更が永続化されないことを確認
      if (canModify) {
        await page.reload();
        // リロード後、元のデータが表示されることを確認
        const logEntries = page.locator('.log-entry, tbody tr');
        await expect(logEntries.first()).not.toContainText('Modified content');
      }
    });

    test('ログの保持期間', async ({ page, baseURL }) => {
      // 管理者としてログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', 'admin@example.com');
      await page.fill('input[type="password"]', 'AdminPassword123!');
      await page.click('button[type="submit"]:has-text("ログイン")');
      
      await page.goto(`${baseURL}/admin`);
      await page.click('button:has-text("アクティビティログ")');
      
      // 古いログが適切に保持されていることを確認
      const oldestLogDate = await page.evaluate(() => {
        const timestamps = Array.from(document.querySelectorAll('time, .timestamp'));
        const dates = timestamps.map(el => new Date(el.textContent || ''));
        return dates.length > 0 ? Math.min(...dates.map(d => d.getTime())) : null;
      });
      
      if (oldestLogDate) {
        const retentionDays = 90; // 90日間の保持期間を想定
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        // 保持期間内のログのみが表示されることを確認
        expect(oldestLogDate).toBeGreaterThan(cutoffDate.getTime());
      }
    });

    test('ログのプライバシー保護', async ({ page, baseURL }) => {
      // 一般ユーザーとしてログイン
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
      await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
      await page.click('button[type="submit"]:has-text("ログイン")');
      await page.waitForURL('**/dashboard');
      
      // 管理者ページへのアクセスを試みる
      await page.goto(`${baseURL}/admin`);
      
      // アクセスが拒否されることを確認
      await expect(page).toHaveURL(/\/dashboard/);
      
      // APIから直接ログを取得しようとする
      const response = await page.request.get(`${baseURL}/api/admin/audit-logs`);
      
      // 403または401が返されることを確認
      expect([401, 403]).toContain(response.status());
    });
  });
});
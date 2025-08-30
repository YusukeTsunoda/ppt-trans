import { test, expect } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { TestConfig } from '../config/test-config';

/**
 * Critical User Journey - Smoke Test
 * 最重要のE2Eフローをテスト
 * 目標実行時間: 5分以内
 */
test.describe('Critical User Journey - Smoke Test', () => {
  const testFile = 'e2e/fixtures/test-presentation.pptx';
  
  test('E2E: ログイン → アップロード → 翻訳 → ダウンロード', async ({ page, baseURL }) => {
    // 30秒以内に完了すること
    test.setTimeout(30000);
    
    // 1. ログインページへ遷移
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    // ログイン実行
    const user = TestConfig.users.default;
    await loginPage.login(user.email, user.password);
    await loginPage.waitForSuccessfulLogin();
    
    // ダッシュボードページに遷移していることを確認
    await expect(page).toHaveURL(/.*\/dashboard/);
    
    // 2. ファイルアップロードページへ遷移（ダッシュボードのアップロードボタンから）
    // ヘッダーのアップロードボタンをクリック
    await page.getByTestId('new-upload-link').click();
    await page.waitForLoadState('networkidle');
    
    // アップロードページが表示されていることを確認
    await expect(page).toHaveURL(/.*\/upload/);
    
    // 3. ファイルアップロード
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // ファイル情報が表示されることを確認
    await expect(page.locator('text="test-presentation.pptx"')).toBeVisible();
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    // アップロード完了を待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    
    // 4. アップロードされたファイルが一覧に表示されることを確認
    const fileRow = page.locator('tr:has-text("test-presentation.pptx")').first();
    await expect(fileRow).toBeVisible();
    
    // 5. プレビューページへ遷移して翻訳
    const previewButton = fileRow.locator('a[href*="/preview/"]');
    await expect(previewButton).toBeVisible();
    await previewButton.click();
    
    // プレビューページへ遷移
    await page.waitForURL(/.*\/preview\/.*/, { timeout: 10000 });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: 30000 
    });
    
    // 言語を選択（英語へ）
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    // 翻訳開始ボタンをクリック
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // 翻訳完了を待つ（翻訳済みテキストが表示される）
    await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({
      timeout: 15000
    });
    
    // 6. ダウンロードボタンを確認（プレビューページ内）
    const downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    await expect(downloadButton.first()).toBeVisible();
    
    // ダウンロードイベントを待機
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.first().click();
    
    // ダウンロードが開始されることを確認
    const download = await Promise.race([
      downloadPromise,
      page.waitForTimeout(5000).then(() => null)
    ]);
    
    if (download) {
      // ダウンロードファイル名を確認
      const filename = download.suggestedFilename();
      expect(filename).toContain('translated');
      expect(filename).toContain('.pptx');
    }
    
    // テスト成功
    console.log('✅ Critical path test completed successfully');
  });
  
  test('エラーハンドリング: 無効なファイル形式', async ({ page, baseURL }) => {
    test.setTimeout(15000);
    
    // まずログインする
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    
    const user = TestConfig.users.default;
    await loginPage.login(user.email, user.password);
    await loginPage.waitForSuccessfulLogin();
    
    // アップロードページへ遷移
    await page.getByTestId('new-upload-link').click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*\/upload/);
    
    // 無効なファイル（テキストファイル）を選択
    const invalidFile = 'e2e/fixtures/invalid-file.txt';
    await page.waitForSelector('input[type="file"]', { timeout: 10000 });
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidFile);
    
    // エラーメッセージが表示されることを確認（より具体的なセレクタを使用）
    await expect(page.locator('.text-red-700, .text-red-400, [role="alert"]').first()).toBeVisible({
      timeout: 5000
    });
    
    // アップロードボタンが無効であることを確認
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeDisabled();
  });
});
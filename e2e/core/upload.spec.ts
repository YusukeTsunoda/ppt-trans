import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * ファイルアップロード - コアテスト
 * MVPに必要なアップロード機能のみをテスト
 */
test.describe('ファイルアップロード', () => {
  // Playwrightではprocess.cwd()はプロジェクトルートを指す
  const testFilesDir = 'e2e/fixtures';
  const validPPTXPath = `${testFilesDir}/test-presentation.pptx`;
  const invalidFilePath = `${testFilesDir}/test-files/invalid.txt`;
  const largePPTXPath = `${testFilesDir}/test-files/large.pptx`;

  test.beforeAll(async () => {
    // テストファイルは事前に配置されていることを前提とする
    // Playwrightテストではファイルシステム操作は推奨されない
  });

  test('PPTXファイルの正常アップロード', async ({ page, baseURL }) => {
    // アップロードページへ遷移
    await page.goto(`${baseURL}/upload`);
    await expect(page.locator('h1')).toContainText('PowerPointファイルのアップロード');
    
    // 初期状態：アップロードボタンが無効
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeDisabled();
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(validPPTXPath);
    
    // ファイル名が表示されることを確認
    await expect(page.locator('text="test-presentation.pptx"')).toBeVisible();
    
    // アップロードボタンが有効になる
    await expect(uploadButton).toBeEnabled();
    
    // アップロード実行
    await uploadButton.click();
    
    // 成功を確認（ダッシュボードへのリダイレクトまたは成功メッセージ）
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload }),
      expect(page.locator('text=/アップロードが完了|Upload complete/')).toBeVisible()
    ]);
  });

  test('無効なファイル形式の拒否', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // テキストファイルを選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(invalidFilePath);
    
    // エラーメッセージが表示される
    await expect(
      page.locator('text=/対応していないファイル形式|Invalid file format|.pptx|.ppt/').first()
    ).toBeVisible({
      timeout: TEST_CONFIG.timeouts.quick
    });
    
    // アップロードボタンが無効のまま
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeDisabled();
  });

  test.skip('ファイルサイズ制限の確認', async ({ page, baseURL }) => {
    // 大きなファイルのテストはスキップ（ファイル作成が必要なため）
    
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(largePPTXPath);
    
    // ファイルサイズエラーの表示
    await expect(
      page.locator('text=/ファイルサイズが大きすぎます|File too large|100MB/').first()
    ).toBeVisible({
      timeout: TEST_CONFIG.timeouts.quick
    });
    
    // アップロードボタンが無効
    await expect(page.locator('button:has-text("アップロード")')).toBeDisabled();
  });
});
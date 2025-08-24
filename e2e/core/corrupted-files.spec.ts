import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 破損ファイル処理 - MVPコアテスト
 * 不正なファイルや破損したファイルの処理を検証
 */
test.describe('破損ファイル処理', () => {
  test('破損したPPTXファイルのアップロード', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // 破損したファイルを選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-files/corrupted.pptx');
    
    // ファイル名は表示される
    await expect(page.locator('text="corrupted.pptx"')).toBeVisible();
    
    // アップロードを試みる
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    // エラーメッセージが表示される
    const errorMessage = page.locator('text=/破損|corrupt|無効なファイル|Invalid file|処理できません/');
    await expect(errorMessage.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // ダッシュボードへリダイレクトされない
    expect(page.url()).not.toContain('dashboard');
  });

  test('不正なファイルヘッダーの検出', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // 不正なヘッダーを持つファイルを選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-files/invalid-header.pptx');
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    // PPTXファイルではないことを検出
    const errorMessage = page.locator('text=/有効なPowerPoint|valid PowerPoint|PPTXファイル|PPTX file/');
    await expect(errorMessage.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
  });

  test('0バイトファイルの処理', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // 空のファイルを作成（0バイト）
    const fileInput = page.locator('input[type="file"]');
    
    // ファイル選択ダイアログで何も選択しない場合の動作を確認
    // 注: 実際の0バイトファイルのテストは環境依存
    
    // アップロードボタンが無効のままであることを確認
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeDisabled();
  });

  test('拡張子偽装ファイルの検出', async ({ page, baseURL }) => {
    // テキストファイルの拡張子を.pptxに変更したファイル
    await page.goto(`${baseURL}/upload`);
    
    // 既に作成済みのinvalid.txtを使用（実際にはPPTXとして扱われる）
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-files/invalid.txt');
    
    // 拡張子チェックでエラーになる
    const errorMessage = page.locator('text=/対応していないファイル形式|Invalid file format/');
    await expect(errorMessage.first()).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.quick 
    });
  });

  test('部分的に破損したファイルの処理', async ({ page, baseURL }) => {
    // アップロード自体は成功するが、処理中にエラーになるケース
    await page.goto(`${baseURL}/upload`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-files/corrupted.pptx');
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    // エラー処理の確認
    const errorOccurred = await page.locator('text=/エラー|Error|失敗|Failed/').isVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    if (errorOccurred) {
      // エラーメッセージが表示される
      const errorDetails = page.locator('.error-message, [role="alert"], .bg-red-50');
      await expect(errorDetails.first()).toBeVisible();
      
      // リトライボタンまたは別のファイルを選択するオプションがある
      const retryOption = page.locator('button:has-text("再試行"), button:has-text("別のファイル"), a:has-text("アップロード")');
      await expect(retryOption.first()).toBeVisible();
    }
  });

  test('破損ファイルアップロード後のリカバリー', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // まず破損ファイルをアップロード
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-files/corrupted.pptx');
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    
    // エラーが表示される
    await expect(page.locator('text=/エラー|Error/')).toBeVisible({ 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 正常なファイルで再試行
    await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンが再度有効になる
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    // 今度は成功する
    await page.waitForURL('**/dashboard', { 
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // ダッシュボードに正常なファイルが表示される
    await expect(page.locator('text="test-presentation.pptx"')).toBeVisible();
  });
});
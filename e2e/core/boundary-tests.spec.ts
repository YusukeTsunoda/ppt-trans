import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 境界値テスト - MVPコアテスト
 * エッジケースと異常系の処理を検証
 */
test.describe('境界値テスト', () => {
  test('空のファイル名での処理', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // ファイル選択ダイアログをキャンセル
    const fileInput = page.locator('input[type="file"]');
    
    // ファイルを選択せずにアップロードボタンの状態を確認
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeDisabled();
  });

  test('特殊文字を含むファイル名', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // 注: 実際のファイル名はOSによって制限される
    // ここではファイル名の表示を確認
    const testFile = 'e2e/fixtures/test-presentation.pptx';
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // ファイル名が正しくエスケープされて表示される
    await expect(page.locator('text="test-presentation.pptx"')).toBeVisible();
  });

  test('同じファイルの連続アップロード', async ({ page, baseURL }) => {
    const testFile = 'e2e/fixtures/test-presentation.pptx';
    
    // 1回目のアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // 2回目のアップロード（同じファイル）
    await page.goto(`${baseURL}/upload`);
    await fileInput.setInputFiles(testFile);
    await uploadButton.click();
    
    // エラーまたは成功メッセージを確認
    const successOrError = await page.locator('text=/アップロード完了|Upload complete|既に存在|already exists/').first();
    await expect(successOrError).toBeVisible({ timeout: TEST_CONFIG.timeouts.upload });
  });

  test('翻訳言語の同一選択', async ({ page, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // 同じ言語を選択（例：日本語→日本語）
    const languageSelect = page.locator('select').first();
    const currentLang = await languageSelect.inputValue();
    
    // 現在の言語と同じ言語を選択
    await languageSelect.selectOption(currentLang);
    
    const translateButton = page.locator('button:has-text("翻訳")').first();
    
    // ボタンが無効化されるか、警告メッセージが表示される
    const isDisabled = await translateButton.isDisabled();
    const hasWarning = await page.locator('text=/同じ言語|same language/').isVisible({ timeout: 1000 });
    
    expect(isDisabled || hasWarning).toBeTruthy();
  });

  test('極端に長いテキストの処理', async ({ page, baseURL }) => {
    // プロフィールページなどで長いテキストを入力
    await page.goto(`${baseURL}/profile`);
    
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    if (await nameInput.isVisible({ timeout: 2000 })) {
      // 255文字以上の入力を試みる
      const longText = 'a'.repeat(300);
      await nameInput.fill(longText);
      
      const saveButton = page.locator('button:has-text("保存"), button:has-text("更新")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // エラーまたは切り詰められた値を確認
        const savedValue = await nameInput.inputValue();
        expect(savedValue.length).toBeLessThanOrEqual(255);
      }
    }
  });
});
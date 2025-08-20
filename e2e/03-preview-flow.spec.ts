import { test, expect, TEST_USER } from './fixtures/test-base';
import { join } from 'path';

/**
 * プレビューフロー統合テスト
 * preview関連のすべてのテストを統合
 */
test.describe('プレビューフロー統合テスト', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');
  
  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });
  
  test.describe('プレビュー表示', () => {
    test('ダッシュボードからプレビュー画面への遷移', async ({ page, baseURL }) => {
      // ファイルアップロード
      await page.goto(`${baseURL}/upload`);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeEnabled({ timeout: 5000 });
      
      // アップロード実行とダッシュボードへの遷移を確実に待つ
      await Promise.all([
        page.waitForURL('**/dashboard', { timeout: 15000 }),
        uploadButton.click()
      ]);
      
      // ページが完全に読み込まれるのを待つ
      await page.waitForLoadState('networkidle');
      
      // プレビューボタンの存在確認（必須）
      const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
      await expect(previewButton).toBeVisible({ 
        timeout: 10000,
        message: 'プレビューボタンが表示されていません' 
      });
      
      // プレビューページへ遷移
      await previewButton.click();
      
      // プレビューページの確認（必須）
      await expect(page).toHaveURL(/.*\/preview\/.*/, { timeout: 10000 });
      await expect(page.locator('h1:has-text("プレビュー")')).toBeVisible({ 
        timeout: 10000,
        message: 'プレビュー画面が表示されていません'
      });
    });
    
    test('プレビュー画面でのテキスト抽出表示', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // プレビューボタンを探す
      const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
      
      // ボタンの存在確認（必須：前提条件）
      await expect(previewButton).toHaveCount(1, {
        message: 'テストの前提条件が満たされていません：プレビュー可能なファイルがありません'
      });
      
      await previewButton.click();
      await page.waitForLoadState('networkidle');
      
      // テキスト抽出の完了を待機（必須）
      await expect(async () => {
        const slideTexts = page.locator('[data-testid="slide-text"]');
        const errorMessage = page.locator('[data-testid="upload-error"]');
        
        const textCount = await slideTexts.count();
        const errorCount = await errorMessage.count();
        
        // 改善: エラーの有無に関わらず、必ず検証を実行
        // エラーがある場合は明示的に失敗
        expect(errorCount).toBe(0);
        
        // テキストが抽出されていることを確認（必須）
        expect(textCount).toBeGreaterThan(0);
      }).toPass({
        timeout: 30000,
        intervals: [1000, 2000, 5000]
      });
    });
    
    test('プレビュー画面からダッシュボードへの戻り', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
      
      // 前提条件の確認（必須）
      await expect(previewButton).toHaveCount(1, {
        message: 'プレビュー可能なファイルが存在しません'
      });
      
      await previewButton.click();
      await page.waitForLoadState('networkidle');
      
      // 戻るリンクの存在確認（必須）
      const backButton = page.locator('a:has-text("ダッシュボード"), button:has-text("戻る"), a:has-text("Back")');
      await expect(backButton).toBeVisible({
        timeout: 10000,
        message: 'ダッシュボードへの戻りリンクが表示されていません'
      });
      
      await backButton.first().click();
      
      // ダッシュボードに戻る確認（必須）
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
      await expect(page.locator('[data-testid="uploaded-files-title"], h2:has-text("ファイル")')).toBeVisible({
        timeout: 5000,
        message: 'ダッシュボードに戻っていません'
      });
    });
  });
  
  test.describe('レスポンシブデザイン', () => {
    test('プレビュー画面のレスポンシブ表示', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
      
      // 前提条件の確認（必須）
      await expect(previewButton).toHaveCount(1, {
        message: 'プレビュー可能なファイルが存在しません'
      });
      
      await previewButton.click();
      
      // 各ビューポートでの表示確認
      const viewports = [
        { width: 1920, height: 1080, name: 'デスクトップ' },
        { width: 768, height: 1024, name: 'タブレット' },
        { width: 375, height: 667, name: 'モバイル' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);
        
        // 各ビューポートでの表示確認（必須）
        await expect(page.locator('[data-testid="preview-container"], main, .container').first()).toBeVisible({
          timeout: 5000,
          message: `${viewport.name}ビューでプレビューコンテナが表示されていません`
        });
      }
    });
  });
  
  test.describe('エラーハンドリング', () => {
    test('存在しないファイルIDのプレビューページ', async ({ page, baseURL }) => {
      // 存在しないIDでアクセス
      await page.goto(`${baseURL}/preview/non-existent-id-12345`);
      
      // エラー処理の確認（必須：リダイレクトまたはエラーメッセージ）
      // 改善: 明示的な期待値を設定
      await expect(async () => {
        const currentUrl = page.url();
        const errorMessage = page.locator('text=/エラー|見つかりません|Not found|Error/i');
        const errorCount = await errorMessage.count();
        
        // 以下のいずれかの条件を満たす必要がある
        const isRedirectedToDashboard = currentUrl.includes('/dashboard');
        const isRedirectedToLogin = currentUrl.includes('/login');
        const hasErrorMessage = errorCount > 0;
        
        const isValidState = isRedirectedToDashboard || isRedirectedToLogin || hasErrorMessage;
        
        expect(isValidState).toBeTruthy();
        return isValidState;
      }).toPass({
        timeout: 10000,
        intervals: [1000, 2000, 3000],
        message: '無効なファイルIDアクセス時の適切な処理（リダイレクトまたはエラー表示）が確認できません'
      });
    });
  });
});
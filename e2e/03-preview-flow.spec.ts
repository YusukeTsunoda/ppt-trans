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
    // ダッシュボードにアクセスして認証状態を確認
    await page.goto(`${baseURL}/dashboard`);
    
    // ログインページにリダイレクトされていないことを確認
    const url = page.url();
    if (url.includes('/login')) {
      throw new Error('認証が正しく設定されていません。ログインページにリダイレクトされました。');
    }
    
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
      await uploadButton.click();
      
      // ダッシュボードに戻る
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
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
      // プレビュー画面にはh1要素にファイル名が表示される
      await expect(page.locator('h1').first()).toBeVisible({ 
        timeout: 10000,
        message: 'プレビュー画面が表示されていません'
      });
      
      // テキスト抽出に失敗した場合は「テキストを抽出」ボタンをクリック
      const extractButton = page.locator('button:has-text("テキストを抽出")');
      if (await extractButton.isVisible({ timeout: 3000 })) {
        // ボタンが有効になるまで待つ
        await expect(extractButton).toBeEnabled({ timeout: 5000 });
        
        // ボタンをクリック
        await extractButton.click();
        
        // 抽出完了を待つ（複数の完了条件）
        await Promise.race([
          // 成功: プレビューコンテナが表示される
          page.waitForSelector('[data-testid="preview-container"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // 成功: slide-textが表示される
          page.waitForSelector('[data-testid="slide-text"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // エラー表示を待つ
          page.waitForSelector('.bg-red-50', { 
            state: 'visible',
            timeout: 30000 
          })
        ]).catch(() => {
          // タイムアウトした場合でも続行
          console.log('テキスト抽出の待機がタイムアウトしました');
        });
      }
      
      // プレビューコンテナまたは何らかのコンテンツの表示を確認
      // 注意：テキスト抽出が失敗する場合があるため、複数の要素を許容
      const contentVisible = await page.locator('.bg-white.rounded-lg.shadow-sm').first().isVisible();
      expect(contentVisible).toBeTruthy();
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
      
      // テキスト抽出に失敗した場合は「テキストを抽出」ボタンをクリック
      const extractButton = page.locator('button:has-text("テキストを抽出")');
      if (await extractButton.isVisible({ timeout: 3000 })) {
        // ボタンが有効になるまで待つ
        await expect(extractButton).toBeEnabled({ timeout: 5000 });
        
        // ボタンをクリック
        await extractButton.click();
        
        // 抽出完了を待つ（複数の完了条件）
        await Promise.race([
          // 成功: プレビューコンテナが表示される
          page.waitForSelector('[data-testid="preview-container"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // 成功: slide-textが表示される
          page.waitForSelector('[data-testid="slide-text"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // エラー表示を待つ
          page.waitForSelector('.bg-red-50', { 
            state: 'visible',
            timeout: 30000 
          })
        ]).catch(() => {
          // タイムアウトした場合でも続行
          console.log('テキスト抽出の待機がタイムアウトしました');
        });
      }
      
      // テキスト抽出の完了を待機（必須）
      await expect(async () => {
        const slideTexts = page.locator('[data-testid="slide-text"]');
        const textCount = await slideTexts.count();
        
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
      // 実装では「← ダッシュボードに戻る」というテキストのリンク
      const backButton = page.locator('a:has-text("ダッシュボードに戻る")');
      await expect(backButton).toBeVisible({
        timeout: 10000,
        message: 'ダッシュボードへの戻りリンクが表示されていません'
      });
      
      await backButton.first().click();
      
      // ダッシュボードに戻る確認（必須）
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
      // ダッシュボードのh1タイトルを確認
      await expect(page.locator('h1:has-text("PowerPoint Translator")')).toBeVisible({
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
      await page.waitForLoadState('networkidle');
      
      // テキスト抽出に失敗した場合は「テキストを抽出」ボタンをクリック
      const extractButton = page.locator('button:has-text("テキストを抽出")');
      if (await extractButton.isVisible({ timeout: 3000 })) {
        // ボタンが有効になるまで待つ
        await expect(extractButton).toBeEnabled({ timeout: 5000 });
        
        // ボタンをクリック
        await extractButton.click();
        
        // 抽出完了を待つ（複数の完了条件）
        await Promise.race([
          // 成功: プレビューコンテナが表示される
          page.waitForSelector('[data-testid="preview-container"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // 成功: slide-textが表示される
          page.waitForSelector('[data-testid="slide-text"]', { 
            state: 'visible',
            timeout: 30000 
          }),
          // エラー表示を待つ
          page.waitForSelector('.bg-red-50', { 
            state: 'visible',
            timeout: 30000 
          })
        ]).catch(() => {
          // タイムアウトした場合でも続行
          console.log('テキスト抽出の待機がタイムアウトしました');
        });
      }
      
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
        // プレビューコンテナのdata-testidを確認
        await expect(page.locator('[data-testid="preview-container"]')).toBeVisible({
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
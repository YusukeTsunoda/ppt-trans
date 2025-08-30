import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';
import { TranslatePage } from '../pages/TranslatePage';

/**
 * エラーリカバリー - MVPコアテスト
 * エラー発生時の適切な復帰処理を検証
 */
test.describe('エラーリカバリー', () => {
  const testFilePath = 'e2e/fixtures/test-presentation.pptx';

  test.beforeEach(async ({ page }) => {
    // ログイン
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsStandardUser();
    await loginPage.expectLoginSuccess();
  });

  test('ネットワーク切断からの復帰', async ({ page, context, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // オフラインモードに切り替え
    await context.setOffline(true);
    
    // 翻訳を試みる
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // エラーメッセージが表示されることを確認
    const errorMessage = page.locator('.bg-red-50, [role="alert"], text=/ネットワークエラー|Network error|接続できません/');
    await expect(errorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    
    // オンラインに復帰
    await context.setOffline(false);
    
    // リトライボタンまたは翻訳ボタンが再度有効になることを確認
    const retryButton = page.locator('button:has-text("再試行"), button:has-text("リトライ"), button:has-text("Retry")');
    const translateButtonAfterError = page.locator('button:has-text("翻訳")').first();
    
    // いずれかのボタンが利用可能になる
    const canRetry = await retryButton.first().isVisible({ timeout: 2000 }) || 
                     await translateButtonAfterError.isEnabled({ timeout: 2000 });
    expect(canRetry).toBeTruthy();
    
    // 再度翻訳を実行
    if (await retryButton.first().isVisible()) {
      await retryButton.first().click();
    } else {
      await translateButtonAfterError.click();
    }
    
    // 翻訳が成功することを確認
    await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload
    });
  });

  test('API制限エラー（429）の処理', async ({ page, context, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 429エラーをモック
    await context.route('**/api/translate', route => {
      route.fulfill({
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + 60000).toISOString()
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: 60
        })
      });
    });
    
    // 翻訳を試みる
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // レート制限エラーメッセージが表示されることを確認
    const rateLimitMessage = page.locator('text=/制限に達しました|Rate limit|しばらく待って|Too many requests/');
    await expect(rateLimitMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    
    // 待機時間が表示されることを確認（オプション）
    const waitTimeMessage = page.locator('text=/60.*秒|1.*分|minute/');
    if (await waitTimeMessage.isVisible({ timeout: 1000 })) {
      expect(await waitTimeMessage.textContent()).toBeTruthy();
    }
    
    // ボタンが一時的に無効化されることを確認
    await expect(translateButton).toBeDisabled();
    
    // ルートをクリア（正常なAPIレスポンスに戻す）
    await context.unroute('**/api/translate');
    
    // 少し待ってから再試行できることを確認
    await page.waitForTimeout(2000);
    
    // ボタンが再度有効になるか、リトライボタンが表示される
    const retryAvailable = await translateButton.isEnabled({ timeout: 5000 }) ||
                           await page.locator('button:has-text("再試行")').isVisible({ timeout: 1000 });
    expect(retryAvailable).toBeTruthy();
  });

  test('タイムアウトエラーの処理', async ({ page, context, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // タイムアウトをシミュレート（レスポンスを遅延）
    await context.route('**/api/translate', async route => {
      // 30秒遅延させる（通常のタイムアウトを超える）
      await new Promise(resolve => setTimeout(resolve, 30000));
      route.abort('timedout');
    });
    
    // 翻訳を試みる
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // タイムアウトエラーが表示されることを確認
    const timeoutMessage = page.locator('text=/タイムアウト|Timeout|時間切れ|応答がありません/');
    await expect(timeoutMessage.first()).toBeVisible({ timeout: 35000 });
    
    // ルートをクリア
    await context.unroute('**/api/translate');
    
    // リトライが可能であることを確認
    const retryButton = page.locator('button:has-text("再試行"), button:has-text("リトライ")');
    const canRetry = await retryButton.first().isVisible({ timeout: 2000 }) ||
                     await translateButton.isEnabled({ timeout: 2000 });
    expect(canRetry).toBeTruthy();
  });

  test('サーバーエラー（500）からの復帰', async ({ page, context, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    let attemptCount = 0;
    
    // 最初は500エラー、2回目で成功するようにモック
    await context.route('**/api/translate', route => {
      attemptCount++;
      if (attemptCount === 1) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      } else {
        // 2回目は成功
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            translatedText: 'This is translated text',
            status: 'success'
          })
        });
      }
    });
    
    // 翻訳を試みる
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // サーバーエラーメッセージが表示されることを確認
    const serverErrorMessage = page.locator('text=/サーバーエラー|Server error|500|内部エラー/');
    await expect(serverErrorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    
    // リトライボタンまたは翻訳ボタンをクリック
    const retryButton = page.locator('button:has-text("再試行"), button:has-text("リトライ")');
    if (await retryButton.first().isVisible({ timeout: 2000 })) {
      await retryButton.first().click();
    } else {
      await translateButton.click();
    }
    
    // 2回目は成功することを確認
    await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload
    });
    
    // ルートをクリア
    await context.unroute('**/api/translate');
  });

  test('部分的な失敗からの復帰（バッチ処理）', async ({ page, context, baseURL }) => {
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    let requestCount = 0;
    
    // 3回目のリクエストでエラーを発生させる
    await context.route('**/api/translate', route => {
      requestCount++;
      if (requestCount === 3) {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Batch processing failed' })
        });
      } else {
        route.continue();
      }
    });
    
    // すべてのスライドを翻訳
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateAllButton = page.locator('button:has-text("すべて翻訳")');
    await translateAllButton.click();
    
    // 部分的なエラーメッセージが表示されることを確認
    const partialErrorMessage = page.locator('text=/一部.*失敗|Partial.*failure|部分的.*エラー/');
    const hasPartialError = await partialErrorMessage.first().isVisible({ timeout: 10000 });
    
    if (hasPartialError) {
      // 失敗したスライドの再試行ボタンが表示される
      const retryFailedButton = page.locator('button:has-text("失敗したスライドを再試行"), button:has-text("Retry failed")');
      if (await retryFailedButton.isVisible({ timeout: 2000 })) {
        // ルートをクリア（成功するように）
        await context.unroute('**/api/translate');
        
        // 再試行
        await retryFailedButton.click();
        
        // 完了メッセージが表示されることを確認
        await expect(page.locator('text=/翻訳が完了|Translation completed/')).toBeVisible({
          timeout: TEST_CONFIG.timeouts.upload
        });
      }
    }
    
    // ルートをクリア
    await context.unroute('**/api/translate');
  });

  test('認証エラーからの復帰', async ({ page, context, baseURL }) => {
    // プレビューページへ直接アクセス（セッション切れをシミュレート）
    await context.route('**/api/translate', route => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      });
    });
    
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 翻訳を試みる
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    // 認証エラーメッセージまたはログインページへのリダイレクト
    const authErrorMessage = page.locator('text=/認証.*必要|Unauthorized|ログイン.*必要|セッション.*期限/');
    const hasAuthError = await authErrorMessage.first().isVisible({ timeout: 5000 });
    const isRedirectedToLogin = page.url().includes('/login');
    
    expect(hasAuthError || isRedirectedToLogin).toBeTruthy();
    
    if (isRedirectedToLogin) {
      // 再ログイン
      const loginPage = new LoginPage(page);
      await loginPage.loginAsStandardUser();
      
      // 元のページに戻ることを確認
      const callbackUrl = new URL(page.url()).searchParams.get('callbackUrl');
      if (callbackUrl) {
        await expect(page).toHaveURL(callbackUrl, { timeout: TEST_CONFIG.timeouts.navigation });
      }
    }
    
    // ルートをクリア
    await context.unroute('**/api/translate');
  });
});
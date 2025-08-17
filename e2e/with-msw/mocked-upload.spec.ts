import { test, expect } from '@playwright/test';
import { mswServer } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { 
  waitForServerAction, 
  waitForNetworkIdle,
  waitForFormSubmission 
} from '../helpers/wait-strategies';

/**
 * MSWを使用したモックテスト
 * ネットワークリクエストを完全に制御
 */
test.describe('MSWモック: アップロードフロー', () => {
  // 認証状態を使用
  test.use({ storageState: 'auth.json' });

  test.beforeAll(() => {
    // MSWサーバーを起動
    mswServer.start();
  });

  test.afterEach(() => {
    // 各テスト後にハンドラーをリセット
    mswServer.reset();
  });

  test.afterAll(() => {
    // MSWサーバーを停止
    mswServer.stop();
  });

  test('成功シナリオ: ファイルアップロード', async ({ page }) => {
    // アップロード成功をモック
    mswServer.use(
      http.post('*/api/upload', async () => {
        return HttpResponse.json({
          success: true,
          fileId: 'mock-file-123',
          message: 'アップロード成功'
        });
      })
    );

    await page.goto('/upload');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await uploadButton.click();
    
    // Server Actionの完了を待つ（waitForTimeoutを使わない）
    await waitForServerAction(page, {
      successIndicator: '[data-testid="upload-success"]',
      expectedText: 'アップロード成功',
      expectedUrl: /dashboard/,
      timeout: 10000
    });
    
    // 成功メッセージを確認
    const successMessage = page.locator('text=/アップロード成功/');
    await expect(successMessage).toBeVisible();
  });

  test('エラーシナリオ: ネットワークエラー', async ({ page }) => {
    // ネットワークエラーを有効化
    mswServer.enableErrorScenario('networkError');
    
    await page.goto('/upload');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await uploadButton.click();
    
    // エラー表示を待つ
    await waitForServerAction(page, {
      errorIndicator: '[role="alert"]',
      expectedText: 'エラー',
      timeout: 10000
    });
    
    // エラーメッセージを確認
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
  });

  test('エラーシナリオ: サーバーエラー (500)', async ({ page }) => {
    // サーバーエラーを有効化
    mswServer.enableErrorScenario('serverError');
    
    await page.goto('/upload');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await uploadButton.click();
    
    // エラー表示を待つ（page.waitForFunctionを活用）
    await page.waitForFunction(
      () => {
        const alerts = document.querySelectorAll('[role="alert"]');
        return Array.from(alerts).some(alert => 
          alert.textContent?.includes('エラー') || 
          alert.textContent?.includes('失敗')
        );
      },
      { timeout: 10000 }
    );
    
    // エラーメッセージの内容を確認
    const errorMessage = page.locator('[role="alert"]');
    const errorText = await errorMessage.textContent();
    expect(errorText).toContain('エラー');
  });

  test('エラーシナリオ: レート制限 (429)', async ({ page }) => {
    // レート制限エラーを有効化
    mswServer.enableErrorScenario('rateLimitError');
    
    await page.goto('/upload');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await uploadButton.click();
    
    // レート制限メッセージを待つ
    await page.waitForFunction(
      () => document.body.textContent?.includes('Too Many Requests') ||
           document.body.textContent?.includes('制限'),
      { timeout: 10000 }
    );
    
    // エラーメッセージを確認
    const errorMessage = page.locator('text=/Too Many Requests|制限/');
    await expect(errorMessage).toBeVisible();
  });

  test('プログレス表示の検証', async ({ page }) => {
    // 遅延レスポンスをモック（プログレス表示を確認するため）
    mswServer.use(
      http.post('*/api/upload', async () => {
        // 3秒待機してから成功レスポンス
        await new Promise(resolve => setTimeout(resolve, 3000));
        return HttpResponse.json({
          success: true,
          fileId: 'delayed-file-123'
        });
      })
    );
    
    await page.goto('/upload');
    
    // ファイル選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./e2e/fixtures/test-presentation.pptx');
    
    // アップロードボタンをクリック
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await uploadButton.click();
    
    // プログレスインジケーターが表示されることを確認
    const progressIndicator = page.locator('[data-testid="upload-progress"], .loading-spinner');
    await expect(progressIndicator).toBeVisible({ timeout: 1000 });
    
    // 完了を待つ
    await waitForServerAction(page, {
      successIndicator: '[data-testid="upload-success"]',
      loadingIndicator: '[data-testid="upload-progress"]',
      timeout: 10000
    });
    
    // プログレスインジケーターが消えることを確認
    await expect(progressIndicator).not.toBeVisible();
  });
});

/**
 * フォーム送信の高度なテスト
 */
test.describe('MSWモック: フォーム送信', () => {
  test.use({ storageState: 'auth.json' });

  test('フォーム送信の完了を適切に待つ', async ({ page }) => {
    // カスタムハンドラーを設定
    mswServer.use(
      http.post('*/api/submit-form', async ({ request }) => {
        const formData = await request.formData();
        const name = formData.get('name');
        
        if (name) {
          return HttpResponse.json({
            success: true,
            message: `${name}さん、送信完了しました`
          });
        }
        
        return HttpResponse.json(
          { error: '名前が必要です' },
          { status: 400 }
        );
      })
    );
    
    await page.goto('/form-page'); // 仮のフォームページ
    
    // フォーム入力
    await page.fill('input[name="name"]', 'テストユーザー');
    
    // フォーム送信を待つ（waitForFormSubmission使用）
    await waitForFormSubmission(page, 'form#test-form', {
      successMessage: '送信完了しました',
      errorMessage: 'エラー',
      timeout: 10000
    });
    
    // 成功メッセージを確認
    const successMessage = page.locator('text=/送信完了/');
    await expect(successMessage).toBeVisible();
  });
});
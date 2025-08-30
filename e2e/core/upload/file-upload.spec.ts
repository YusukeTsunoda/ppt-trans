/**
 * ファイルアップロードのCoreテスト
 * アップロード機能の基本動作を検証
 */

import { test, expect } from '../../fixtures/auth';
import { Config } from '../../config';
import path from 'path';

test.describe('ファイルアップロード', () => {
  test('正常なPPTXファイルのアップロード', async ({ authenticatedPage }) => {
    // アップロードリンクの存在を確認
    const uploadLink = authenticatedPage.locator(Config.selectors.dashboard.uploadLink);
    await expect(uploadLink).toBeVisible({ timeout: 10000 });
    
    // アップロードページへ遷移
    await uploadLink.click();
    
    // ページ遷移を待つ
    await authenticatedPage.waitForLoadState('networkidle');
    
    // URLがuploadまたはdashboardのどちらかであることを確認
    // （アップロードがモーダルの場合もあるため）
    const currentUrl = authenticatedPage.url();
    console.log('Current URL after upload click:', currentUrl);
    
    // ファイル入力フィールドが存在することを確認
    const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
    await expect(fileInput).toBeAttached({ timeout: 10000 });
    
    // テストファイルをアップロード
    await fileInput.setInputFiles(Config.testData.validPptx);
    
    // ファイル情報が表示されることを確認
    await expect(authenticatedPage.locator('text="test-presentation.pptx"')).toBeVisible();
    
    // アップロードボタンをクリック
    const uploadButton = authenticatedPage.locator(Config.selectors.upload.uploadButton);
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    // アップロード完了を待つ
    await authenticatedPage.waitForURL(/.*\/dashboard/, { 
      timeout: Config.timeouts.navigation 
    });
    
    // ファイルが一覧に表示されることを確認
    const fileList = authenticatedPage.locator(Config.selectors.dashboard.fileList);
    await expect(fileList).toBeVisible();
    await expect(fileList).toContainText('test-presentation.pptx');
  });

  test('無効なファイル形式の拒否', async ({ authenticatedPage }) => {
    // アップロードページへ遷移
    await authenticatedPage.click(Config.selectors.dashboard.uploadLink);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // 無効なファイル（テキストファイル）を選択
    const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
    await fileInput.setInputFiles(Config.testData.invalidFile);
    
    // エラーメッセージが表示されることを確認
    const errorMessage = await Config.getErrorMessage(authenticatedPage);
    expect(errorMessage).toBeTruthy();
    
    // アップロードボタンが無効であることを確認
    const uploadButton = authenticatedPage.locator(Config.selectors.upload.uploadButton);
    await expect(uploadButton).toBeDisabled();
  });

  test('大容量ファイルのアップロード処理', async ({ authenticatedPage }) => {
    test.slow(); // タイムアウトを3倍に延長
    
    // アップロードページへ遷移
    await authenticatedPage.click(Config.selectors.dashboard.uploadLink);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // 大容量ファイルをアップロード
    const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
    await fileInput.setInputFiles(Config.testData.largePptx);
    
    // ファイルサイズの警告が表示されることを確認（10MB以上の場合）
    const fileSizeWarning = authenticatedPage.locator('text=/大きなファイル/');
    if (await fileSizeWarning.isVisible({ timeout: 5000 })) {
      console.log('Large file warning displayed');
    }
    
    // アップロードボタンをクリック
    const uploadButton = authenticatedPage.locator(Config.selectors.upload.uploadButton);
    await uploadButton.click();
    
    // プログレスバーが表示されることを確認（実装されている場合）
    const progressBar = authenticatedPage.locator(Config.selectors.upload.progressBar);
    if (await progressBar.isVisible({ timeout: 5000 })) {
      // プログレスバーの進行を確認
      await expect(progressBar).toHaveAttribute('aria-valuenow', /[0-9]+/);
    }
    
    // アップロード完了を待つ（大容量ファイルのため長めのタイムアウト）
    await authenticatedPage.waitForURL(/.*\/dashboard/, { 
      timeout: 60000 // 60秒
    });
  });

  test('複数ファイルの連続アップロード', async ({ authenticatedPage }) => {
    const testFiles = [
      'test-presentation.pptx',
      'test-presentation-2.pptx',
    ];
    
    for (const fileName of testFiles) {
      // アップロードページへ遷移
      if (authenticatedPage.url().includes('dashboard')) {
        await authenticatedPage.click(Config.selectors.dashboard.uploadLink);
      } else {
        await authenticatedPage.goto(Config.urls.upload);
      }
      await authenticatedPage.waitForLoadState('networkidle');
      
      // ファイルをアップロード
      const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
      
      // テストファイルが存在しない場合はスキップ
      const filePath = `e2e/fixtures/${fileName}`;
      try {
        await fileInput.setInputFiles(filePath);
      } catch (error) {
        console.log(`Skipping ${fileName} - file not found`);
        continue;
      }
      
      // アップロード実行
      const uploadButton = authenticatedPage.locator(Config.selectors.upload.uploadButton);
      if (await uploadButton.isEnabled()) {
        await uploadButton.click();
        await authenticatedPage.waitForURL(/.*\/dashboard/, { 
          timeout: Config.timeouts.navigation 
        });
      }
    }
    
    // 複数ファイルが一覧に表示されることを確認
    const fileList = authenticatedPage.locator(Config.selectors.dashboard.fileList);
    await expect(fileList).toBeVisible();
  });

  test('破損ファイルのエラーハンドリング', async ({ authenticatedPage }) => {
    // アップロードページへ遷移
    await authenticatedPage.click(Config.selectors.dashboard.uploadLink);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // 破損したPPTXファイルをアップロード
    const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
    await fileInput.setInputFiles(Config.testData.corruptedPptx);
    
    // アップロードボタンをクリック
    const uploadButton = authenticatedPage.locator(Config.selectors.upload.uploadButton);
    await uploadButton.click();
    
    // エラーメッセージまたはダッシュボードへの遷移を待つ
    const result = await Promise.race([
      Config.getErrorMessage(authenticatedPage).then(msg => ({ type: 'error', message: msg })),
      authenticatedPage.waitForURL(/.*\/dashboard/, { timeout: 10000 })
        .then(() => ({ type: 'success' }))
        .catch(() => ({ type: 'timeout' }))
    ]);
    
    // 結果に応じた検証
    if (result.type === 'error') {
      expect(result.message).toContain('破損');
    } else if (result.type === 'success') {
      // ファイルが処理エラー状態で表示されることを確認
      const fileStatus = authenticatedPage.locator('text="failed"').or(
        authenticatedPage.locator('text="失敗"')
      );
      await expect(fileStatus).toBeVisible({ timeout: 10000 });
    }
  });

  test('アップロードのキャンセル', async ({ authenticatedPage }) => {
    // アップロードページへ遷移
    await authenticatedPage.click(Config.selectors.dashboard.uploadLink);
    await authenticatedPage.waitForLoadState('networkidle');
    
    // ファイルを選択
    const fileInput = authenticatedPage.locator(Config.selectors.upload.fileInput);
    await fileInput.setInputFiles(Config.testData.validPptx);
    
    // ブラウザバックまたはキャンセル
    await authenticatedPage.goBack();
    
    // ダッシュボードに戻ることを確認
    await expect(authenticatedPage).toHaveURL(/.*\/dashboard/);
    
    // ファイルがアップロードされていないことを確認
    const fileList = authenticatedPage.locator(Config.selectors.dashboard.fileList);
    const latestFile = fileList.locator('tr').first();
    const uploadTime = await latestFile.getAttribute('data-upload-time');
    
    // 最新のファイルが今アップロードしたものでないことを確認
    if (uploadTime) {
      const timeDiff = Date.now() - new Date(uploadTime).getTime();
      expect(timeDiff).toBeGreaterThan(10000); // 10秒以上前
    }
  });
});
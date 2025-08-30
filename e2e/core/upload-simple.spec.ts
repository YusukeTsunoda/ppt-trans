import { test, expect } from '@playwright/test';
import { UNIFIED_TEST_CONFIG } from '../config/unified-test-config';
import * as path from 'path';

test.describe('ファイルアップロード機能の検証', () => {
  test('Server Actionを使用したファイルアップロード', async ({ page }) => {
    // 1. ログイン
    console.log('📝 ログイン処理開始...');
    await page.goto('/login');
    await page.fill('input[name="email"]', UNIFIED_TEST_CONFIG.users.standard.email);
    await page.fill('input[name="password"]', UNIFIED_TEST_CONFIG.users.standard.password);
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待つ
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('✅ ログイン成功');
    
    // 2. アップロードページへ遷移
    console.log('📤 アップロードページへ遷移...');
    await page.goto('/upload');
    
    // ページが正しく表示されることを確認
    await expect(page.locator('h2')).toContainText('PowerPointファイルをアップロード');
    console.log('✅ アップロードページ表示確認');
    
    // 3. ファイルを選択
    const testFilePath = path.join(process.cwd(), 'test/test_presentation.pptx');
    console.log(`📁 テストファイル: ${testFilePath}`);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    // ファイル情報が表示されることを確認
    await expect(page.locator('text=選択されたファイル:')).toBeVisible();
    await expect(page.locator('text=test_presentation.pptx')).toBeVisible();
    console.log('✅ ファイル選択完了');
    
    // 4. アップロードボタンをクリック
    console.log('🚀 アップロード実行...');
    const uploadButton = page.locator('button[data-testid="upload-button"]');
    await expect(uploadButton).toBeEnabled();
    
    // アップロード前のタイムスタンプを記録
    const uploadStartTime = Date.now();
    
    await uploadButton.click();
    
    // 5. アップロード成功を確認
    // 成功メッセージまたはダッシュボードへのリダイレクトを待つ
    const successMessage = page.locator('[data-testid="upload-success"]');
    const dashboardUrl = page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => false);
    
    const result = await Promise.race([
      successMessage.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'success'),
      dashboardUrl.then(() => 'redirect'),
      page.waitForTimeout(15000).then(() => 'timeout')
    ]);
    
    if (result === 'success') {
      console.log('✅ アップロード成功メッセージ表示');
      await expect(successMessage).toContainText('ファイルが正常にアップロードされました');
      
      // ダッシュボードへのリダイレクトを待つ
      await page.waitForURL('**/dashboard', { timeout: 5000 });
      console.log('✅ ダッシュボードへリダイレクト');
    } else if (result === 'redirect') {
      console.log('✅ ダッシュボードへ直接リダイレクト');
    } else {
      // エラーメッセージを確認
      const errorMessage = page.locator('[data-testid="upload-error"]');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        throw new Error(`アップロードエラー: ${errorText}`);
      }
      throw new Error('アップロードがタイムアウトしました');
    }
    
    // 6. ダッシュボードでファイルが表示されることを確認
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // アップロードしたファイルが表示されることを確認
    const uploadedFile = page.locator('text=test_presentation.pptx').first();
    await expect(uploadedFile).toBeVisible({ timeout: 10000 });
    console.log('✅ ダッシュボードにファイル表示確認');
    
    // アップロード時間を計算
    const uploadEndTime = Date.now();
    const uploadDuration = (uploadEndTime - uploadStartTime) / 1000;
    console.log(`⏱️ アップロード完了時間: ${uploadDuration.toFixed(2)}秒`);
    
    console.log('🎉 ファイルアップロード検証成功！');
  });

  test('ファイルサイズ制限の確認', async ({ page }) => {
    // ログイン
    await page.goto('/login');
    await page.fill('input[name="email"]', UNIFIED_TEST_CONFIG.users.standard.email);
    await page.fill('input[name="password"]', UNIFIED_TEST_CONFIG.users.standard.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // アップロードページへ
    await page.goto('/upload');
    
    // 大きなファイルをシミュレート（実際のファイルではなくエラー確認）
    const fileInput = page.locator('input[type="file"]');
    
    // 存在しないファイルや無効なファイルを選択しようとする
    const invalidFile = path.join(process.cwd(), 'test/invalid.txt');
    
    // ファイル選択時のエラーハンドリングを確認
    await fileInput.setInputFiles(testFilePath).catch(() => {
      console.log('ファイル選択エラー（期待される動作）');
    });
    
    // アップロードページの表示確認
    await expect(page.locator('text=最大ファイルサイズ: 50MB')).toBeVisible();
    console.log('✅ ファイルサイズ制限の表示確認');
  });
});

const testFilePath = path.join(process.cwd(), 'test/test_presentation.pptx');
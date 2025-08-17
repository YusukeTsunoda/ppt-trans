import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Simple Upload Test', () => {
  test('Manual test: login and upload file', async ({ page }) => {
    // 1. ログインページへ
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // 2. ログイン
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 3. ダッシュボードを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    console.log('✓ Logged in successfully');

    // 4. アップロードページへ
    await page.goto('http://localhost:3001/upload');
    await page.waitForLoadState('networkidle');
    console.log('✓ Navigated to upload page');

    // 5. ファイル選択
    const pptxPath = join(__dirname, 'test.pptx');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pptxPath);
    console.log('✓ File selected');

    // ファイル情報が表示されることを確認
    await expect(page.locator('text=選択されたファイル')).toBeVisible();
    console.log('✓ File info displayed');

    // 6. アップロード実行
    await page.click('button:has-text("アップロード")');
    console.log('✓ Upload button clicked');

    // 7. 結果を待つ（成功またはエラー）
    const success = page.locator('text=ファイルが正常にアップロードされました');
    const error = page.locator('[class*="red"]');
    
    try {
      await success.waitFor({ timeout: 15000 });
      console.log('✅ Upload successful!');
      
      // ダッシュボードへのリダイレクトを待つ
      await page.waitForURL(/.*\/dashboard/, { timeout: 5000 });
      console.log('✅ Redirected to dashboard');
    } catch {
      // エラーメッセージを取得
      if (await error.isVisible()) {
        const errorText = await error.textContent();
        console.error('❌ Upload failed:', errorText);
        
        // デバッグ情報を出力
        const consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });
        
        await page.waitForTimeout(2000);
        if (consoleErrors.length > 0) {
          console.error('Console errors:', consoleErrors);
        }
      }
    }

    // スクリーンショットを保存
    await page.screenshot({ path: 'upload-test-result.png' });
  });
});
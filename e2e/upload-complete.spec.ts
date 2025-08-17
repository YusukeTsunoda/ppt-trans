import { test, expect } from '@playwright/test';
import { join } from 'path';

test.describe('Complete Upload Flow', () => {
  test('Full upload flow: login and upload PowerPoint file', async ({ page }) => {
    // 1. ログインページへアクセス
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');

    // 2. ログイン
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 3. ダッシュボードへのリダイレクトを待つ
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });
    console.log('✅ Login successful');

    // 4. アップロードページへ移動
    await page.goto('http://localhost:3001/upload');
    await page.waitForLoadState('networkidle');
    console.log('✅ Navigated to upload page');

    // 5. ファイル選択フィールドが表示されることを確認
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // accept属性を確認
    const acceptValue = await fileInput.getAttribute('accept');
    expect(acceptValue).toBe('.ppt,.pptx');
    console.log('✅ File input validation passed');

    // 6. PowerPointファイルを選択
    const pptxPath = join(__dirname, 'test.pptx');
    await fileInput.setInputFiles(pptxPath);
    console.log('✅ File selected');

    // 7. ファイル情報が表示されることを確認
    await expect(page.locator('text=選択されたファイル')).toBeVisible();
    await expect(page.locator('text=test.pptx')).toBeVisible();
    console.log('✅ File info displayed');

    // 8. アップロードボタンをクリック
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    console.log('✅ Upload button clicked');

    // 9. アップロード処理の結果を待つ
    // 成功またはエラーメッセージのいずれかが表示される
    const successMessage = page.locator('text=ファイルが正常にアップロードされました');
    const errorMessage = page.locator('[class*="red"]').locator('text=/アップロード|失敗|エラー/');

    try {
      // 成功メッセージを待つ（最大15秒）
      await successMessage.waitFor({ timeout: 15000 });
      console.log('✅ Upload successful!');
      
      // ダッシュボードへの自動リダイレクトを待つ
      await page.waitForURL(/.*\/dashboard/, { timeout: 5000 });
      console.log('✅ Redirected to dashboard');
      
      // アップロードされたファイルがダッシュボードに表示されることを確認
      await expect(page.locator('text=test.pptx')).toBeVisible();
      console.log('✅ File appears in dashboard');
      
    } catch (error) {
      // エラーメッセージが表示された場合
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        console.error('❌ Upload failed:', errorText);
        
        // エラーの詳細をログに出力
        const consoleMessages: string[] = [];
        page.on('console', msg => {
          if (msg.type() === 'error') {
            consoleMessages.push(msg.text());
          }
        });
        
        await page.waitForTimeout(1000);
        if (consoleMessages.length > 0) {
          console.error('Console errors:', consoleMessages);
        }
        
        throw new Error(`Upload failed: ${errorText}`);
      } else {
        throw error;
      }
    }
  });

  test('Upload validation: file size and type restrictions', async ({ page }) => {
    // 1. ログイン
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // 2. アップロードページへ
    await page.goto('http://localhost:3001/upload');
    await page.waitForLoadState('networkidle');

    // 3. ファイルサイズ制限の表示を確認
    await expect(page.locator('text=/最大.*50MB/')).toBeVisible();
    console.log('✅ File size limit displayed');

    // 4. 対応ファイル形式の表示を確認
    await expect(page.locator('text=/pptx.*ppt/')).toBeVisible();
    console.log('✅ Supported file types displayed');

    // 5. ファイル選択フィールドのaccept属性を確認
    const fileInput = page.locator('input[type="file"]');
    const acceptValue = await fileInput.getAttribute('accept');
    expect(acceptValue).toBe('.ppt,.pptx');
    console.log('✅ File input accept attribute correct');
  });

  test('Upload error handling: network interruption', async ({ page, context }) => {
    // 1. ログイン
    await page.goto('http://localhost:3001/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 });

    // 2. アップロードページへ
    await page.goto('http://localhost:3001/upload');
    await page.waitForLoadState('networkidle');

    // 3. ネットワークリクエストをインターセプト
    await context.route('**/storage/v1/object/**', route => {
      // ストレージAPIへのリクエストを失敗させる
      route.abort('failed');
    });

    // 4. ファイル選択
    const pptxPath = join(__dirname, 'test.pptx');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(pptxPath);

    // 5. アップロード試行
    await page.click('button:has-text("アップロード")');

    // 6. エラーメッセージが表示されることを確認
    const errorMessage = page.locator('text=/アップロードに失敗しました|ネットワークエラー|エラーが発生しました/');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    console.log('✅ Error message displayed on network failure');
  });
});
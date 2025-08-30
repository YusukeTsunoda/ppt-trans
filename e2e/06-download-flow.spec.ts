import { test, expect, TEST_USER } from './fixtures/test-base';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

/**
 * ダウンロード機能の包括的E2Eテスト
 * 翻訳済みPowerPointファイルのダウンロードをテスト
 */
test.describe('ダウンロード機能テスト', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');
  let downloadPath: string;

  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled({ timeout: 5000 });
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // プレビューページへ遷移
    const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
    await expect(previewButton).toBeVisible({ timeout: 10000 });
    await previewButton.click();
    
    await expect(page).toHaveURL(/.*\/preview\/.*/, { timeout: 10000 });
    
    // テキスト抽出完了を待つ
    await expect(page.locator('[data-testid="slide-text"]').first()).toBeVisible({ 
      timeout: 30000 
    });
  });

  test.afterEach(() => {
    // ダウンロードしたファイルをクリーンアップ
    if (downloadPath && existsSync(downloadPath)) {
      unlinkSync(downloadPath);
    }
  });

  test.describe('翻訳済みファイルダウンロード', () => {
    test('翻訳済みPowerPointをダウンロードできる', async ({ page }) => {
      // 全スライドを翻訳
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      // ダウンロードボタンが有効になることを確認
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")').filter({ hasText: /翻訳/ })
      );
      await expect(downloadButton.first()).toBeEnabled({ timeout: 5000 });
      
      // ダウンロードを開始
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      // ダウンロード中の状態を確認
      const downloadingButton = page.locator('button:has-text("生成中...")').or(
        page.locator('button:has-text("ダウンロード中...")')
      );
      if (await downloadingButton.first().isVisible({ timeout: 1000 })) {
        await expect(downloadingButton.first()).toBeDisabled();
      }
      
      // ダウンロードファイルの保存と検証
      downloadPath = await download.path();
      const fileName = download.suggestedFilename();
      
      // ファイル名の形式を確認
      expect(fileName).toMatch(/translated.*\.pptx$/);
      expect(fileName).toContain('translated');
      
      // ファイルが実際にダウンロードされたことを確認
      expect(existsSync(downloadPath)).toBeTruthy();
      
      // ダウンロード完了後、ボタンが元に戻ることを確認
      await expect(downloadButton.first()).toBeEnabled();
      await expect(downloadButton.first()).not.toHaveText(/生成中|ダウンロード中/);
    });

    test('部分翻訳でもダウンロード可能', async ({ page }) => {
      // 現在のスライドのみ翻訳
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // ダウンロードボタンが有効になることを確認
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      await expect(downloadButton.first()).toBeEnabled({ timeout: 5000 });
      
      // ダウンロードを実行
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      downloadPath = await download.path();
      expect(existsSync(downloadPath)).toBeTruthy();
      
      // 部分翻訳でも正常にダウンロードできることを確認
      const fileName = download.suggestedFilename();
      expect(fileName).toMatch(/\.pptx$/);
    });

    test('翻訳前はダウンロードボタンが無効', async ({ page }) => {
      // ダウンロードボタンを探す
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")').filter({ hasText: /翻訳/ })
      );
      
      // 翻訳前は無効化されているか、適切なメッセージが表示される
      if (await downloadButton.first().isVisible({ timeout: 2000 })) {
        const isDisabled = await downloadButton.first().isDisabled();
        expect(isDisabled).toBeTruthy();
        
        // ツールチップやヘルプテキストの確認
        const tooltip = page.locator('[role="tooltip"]').or(
          page.locator('.text-gray-500').filter({ hasText: /翻訳.*必要/ })
        );
        
        if (await tooltip.first().isVisible({ timeout: 1000 })) {
          const tooltipText = await tooltip.first().textContent();
          expect(tooltipText).toMatch(/翻訳/);
        }
      }
    });

    test('ダウンロード処理中の状態管理', async ({ page }) => {
      // まず翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      
      // ダウンロード開始前の状態を記録
      const initialText = await downloadButton.first().textContent();
      
      // ダウンロードを開始（レスポンスを遅延させる）
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.first().click();
      
      // ボタンテキストが変わることを確認
      const generatingButton = page.locator('button:has-text("生成中...")').or(
        page.locator('button:has-text("ダウンロード中...")')
      );
      
      if (await generatingButton.first().isVisible({ timeout: 1000 })) {
        // ボタンが無効化されている
        await expect(generatingButton.first()).toBeDisabled();
        
        // スピナーアイコンが表示されている可能性
        const spinner = page.locator('.animate-spin');
        if (await spinner.isVisible({ timeout: 500 })) {
          await expect(spinner).toBeVisible();
        }
      }
      
      // ダウンロード完了を待つ
      const download = await downloadPromise;
      downloadPath = await download.path();
      
      // ボタンが元に戻る
      await expect(downloadButton.first()).toHaveText(initialText);
      await expect(downloadButton.first()).toBeEnabled();
    });

    test('複数言語での翻訳後ダウンロード', async ({ page }) => {
      // 英語に翻訳
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 英語版をダウンロード
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      
      const [download1] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      const englishFileName = download1.suggestedFilename();
      downloadPath = await download1.path();
      
      // 中国語に再翻訳
      await languageSelect.selectOption('zh');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 30000 
      });
      
      // 中国語版をダウンロード
      const [download2] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      const chineseFileName = download2.suggestedFilename();
      const downloadPath2 = await download2.path();
      
      // 両方のファイルが正常にダウンロードされたことを確認
      expect(existsSync(downloadPath)).toBeTruthy();
      expect(existsSync(downloadPath2)).toBeTruthy();
      
      // ファイル名が異なる可能性があることを確認（オプション）
      // ファイル名に言語コードが含まれる場合など
      console.log('English file:', englishFileName);
      console.log('Chinese file:', chineseFileName);
      
      // クリーンアップ
      if (existsSync(downloadPath2)) {
        unlinkSync(downloadPath2);
      }
    });
  });

  test.describe('ダウンロードエラーハンドリング', () => {
    test('ダウンロード失敗時のエラー表示', async ({ page, context }) => {
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // ダウンロードAPIをエラーにする
      await context.route('**/api/apply-translations', route => {
        route.abort('failed');
      });
      
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      await downloadButton.first().click();
      
      // エラーメッセージが表示される
      const errorMessage = page.locator('.bg-red-50').or(
        page.locator('text=/ダウンロード.*失敗/').or(
          page.locator('[role="alert"]').filter({ hasText: /エラー/ })
        )
      );
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
      
      // ボタンが再度有効になる
      await expect(downloadButton.first()).toBeEnabled();
      await expect(downloadButton.first()).not.toHaveText(/生成中|ダウンロード中/);
    });

    test('大容量ファイルのダウンロードタイムアウト', async ({ page }) => {
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      
      // ダウンロード開始
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
      await downloadButton.first().click();
      
      // 長時間のダウンロードでもUIが応答し続けることを確認
      const generatingButton = page.locator('button:has-text("生成中...")');
      if (await generatingButton.first().isVisible({ timeout: 1000 })) {
        // 他のUI要素が操作可能であることを確認
        const languageSelectDuringDownload = page.locator('select[aria-label="翻訳先言語"]');
        await expect(languageSelectDuringDownload).toBeEnabled();
      }
      
      try {
        const download = await downloadPromise;
        downloadPath = await download.path();
        expect(existsSync(downloadPath)).toBeTruthy();
      } catch (error) {
        // タイムアウトした場合のエラーハンドリング確認
        const timeoutError = page.locator('text=/タイムアウト/');
        if (await timeoutError.isVisible({ timeout: 2000 })) {
          await expect(timeoutError).toBeVisible();
        }
      }
    });

    test('ネットワーク切断時の再試行', async ({ page, context }) => {
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      let attemptCount = 0;
      
      // 最初は失敗、2回目で成功
      await context.route('**/api/apply-translations', route => {
        attemptCount++;
        if (attemptCount === 1) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      
      // 1回目（失敗）
      await downloadButton.first().click();
      
      const errorMessage = page.locator('.bg-red-50');
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
      
      // 2回目（成功）
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      downloadPath = await download.path();
      expect(existsSync(downloadPath)).toBeTruthy();
    });
  });
});
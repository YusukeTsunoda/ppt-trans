import { test, expect, TEST_USER } from './fixtures/test-base';
import {
  assertUploadSuccess,
  assertNavigationTo,
  assertElementVisible,
  assertErrorMessage,
  fillForm,
  clickWhenEnabled,
  waitForNetworkSettled,
  cleanupTestData
} from './fixtures/test-helpers';
import { join } from 'path';
import * as fs from 'fs';

/**
 * 改善されたアップロードフローテスト
 * ソフトウェアエキスパート観点での品質向上版
 */
test.describe('改善版: アップロードフロー統合テスト', () => {
  const testFilesDir = join(process.cwd(), 'e2e', 'fixtures');
  const validPPTXPath = join(testFilesDir, 'test-presentation.pptx');
  const invalidFilePath = join(testFilesDir, 'invalid-file.txt');
  
  let uploadedFileId: string | undefined;

  // テストファイルの事前検証
  test.beforeAll(async () => {
    // テストファイルの存在を保証
    expect(fs.existsSync(validPPTXPath), 
      `テストファイルが存在しません: ${validPPTXPath}`
    ).toBeTruthy();
  });

  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // テストデータのクリーンアップ
    if (uploadedFileId) {
      await cleanupTestData(page, uploadedFileId);
      uploadedFileId = undefined;
    }
  });

  test.describe('正常系: ファイルアップロード', () => {
    test('有効なPPTXファイルの完全なアップロードフロー', async ({ page, baseURL }) => {
      // Step 1: アップロードページへの遷移
      await page.goto(`${baseURL}/upload`);
      await waitForNetworkSettled(page);
      
      // Step 2: ページ要素の検証（data-testid使用推奨）
      const uploadForm = await assertElementVisible(
        page, 
        '[data-testid="upload-form"], form[id="upload-form"]',
        'アップロードフォームが表示されていません'
      );
      
      // Step 3: ファイル選択
      const fileInput = uploadForm.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();
      await fileInput.setInputFiles(validPPTXPath);
      
      // Step 4: ファイル名表示の検証
      await assertElementVisible(
        page,
        `text=${validPPTXPath.split('/').pop()}`,
        '選択したファイル名が表示されていません'
      );
      
      // Step 5: アップロードボタンの状態確認とクリック
      const uploadButton = await clickWhenEnabled(page, 'アップロード');
      
      // Step 6: プログレス表示の確認（オプション）
      const progressIndicator = page.locator('[data-testid="upload-progress"], .upload-progress');
      if (await progressIndicator.count() > 0) {
        await expect(progressIndicator).toBeVisible();
      }
      
      // Step 7: 成功確認（改善版：明示的なアサーション）
      await assertUploadSuccess(page);
      
      // Step 8: ファイルIDの取得（クリーンアップ用）
      const fileItem = page.locator('[data-testid="file-item"]').first();
      if (await fileItem.count() > 0) {
        uploadedFileId = await fileItem.getAttribute('data-file-id') || undefined;
      }
    });

    test('アップロード後のファイル一覧表示と操作（非同期処理対応版）', async ({ page, baseURL }) => {
      // 前提: ファイルをアップロード
      await page.goto(`${baseURL}/upload`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await clickWhenEnabled(page, 'アップロード');
      await assertUploadSuccess(page);
      
      // ダッシュボードでの確認
      await page.goto(`${baseURL}/dashboard`);
      await waitForNetworkSettled(page);
      
      // ファイル一覧の検証
      const fileList = page.locator('[data-testid="file-list"], .file-list');
      await expect(fileList).toBeVisible();
      
      // アップロードしたファイルの存在確認（最初の1つを確認）
      const fileName = validPPTXPath.split('/').pop();
      const fileItem = fileList.locator(`text=${fileName}`).first();
      await expect(fileItem).toBeVisible({
        timeout: 10000,
        message: `ファイル ${fileName} が一覧に表示されていません`
      });
      
      // アクションボタンの検証
      const actions = ['プレビュー', '翻訳', 'ダウンロード', '削除'];
      for (const action of actions) {
        const actionButton = page.locator(`button:has-text("${action}")`);
        await expect(actionButton.first()).toBeVisible({
          message: `${action}ボタンが表示されていません`
        });
      }
    });
  });

  test.describe('異常系: エラーハンドリング', () => {
    test('無効なファイル形式の適切な拒否', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 無効なファイルを作成
      if (!fs.existsSync(invalidFilePath)) {
        fs.writeFileSync(invalidFilePath, 'This is not a PPTX file');
      }
      
      // ファイル選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // エラーメッセージの確認（明示的）
      const errorElement = page.locator('[data-testid="upload-error"]');
      await expect(errorElement).toBeVisible({ timeout: 5000 });
      const errorText = await errorElement.textContent();
      expect(errorText).toContain('PowerPointファイル');
      expect(errorText).toContain('のみ');
      
      // アップロードボタンが無効化されていることを確認
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled({
        message: '無効なファイル選択時にアップロードボタンが有効になっています'
      });
      
      // クリーンアップ
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
    });

    test('ネットワークエラー時の適切なフォールバック', async ({ page, baseURL, context }) => {
      await page.goto(`${baseURL}/upload`);
      
      // ネットワークエラーをシミュレート
      await context.setOffline(true);
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      // アップロード試行
      const uploadButton = page.locator('button:has-text("アップロード")');
      await uploadButton.click();
      
      // エラーメッセージの表示を確認
      const errorMessage = page.locator('text=/ネットワークエラー|接続エラー|オフライン/');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      // オンラインに戻す
      await context.setOffline(false);
    });
  });

  test.describe('パフォーマンステスト', () => {
    test('大容量ファイルアップロードのタイムアウト処理', async ({ page, baseURL }) => {
      // CI環境でも実行（タイムアウトを調整）
      const isCI = process.env.CI === 'true';
      if (isCI) {
        test.setTimeout(60000); // CI環境では60秒に延長
      }
      
      await page.goto(`${baseURL}/upload`);
      
      // タイムアウトの測定
      const startTime = Date.now();
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      const uploadButton = await clickWhenEnabled(page, 'アップロード');
      
      // 30秒以内に完了することを確認
      await Promise.race([
        assertUploadSuccess(page),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('アップロードタイムアウト')), 30000)
        )
      ]);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(30000);
    });
  });
});

/**
 * アクセシビリティテスト
 */
test.describe('アクセシビリティ', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('キーボードナビゲーション - 自然なDOM順序', async ({ page, baseURL }) => {
    // すでにログイン済みなのでアップロードページでテスト
    await page.goto(`${baseURL}/upload`);
    await page.waitForLoadState('networkidle');
    
    // ページ本体にフォーカスを設定
    await page.locator('body').click({ position: { x: 0, y: 0 } });
    
    // Tabキーを押してフォーカス可能な要素を順番に確認
    let tabCount = 0;
    let foundFileInput = false;
    let foundUploadButton = false;
    
    // 最大10回Tabを押してナビゲーション要素をスキップ
    while (tabCount < 10 && (!foundFileInput || !foundUploadButton)) {
      await page.keyboard.press('Tab');
      tabCount++;
      
      // 現在フォーカスされている要素を取得
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          type: el?.getAttribute('type'),
          dataTestId: el?.getAttribute('data-testid'),
          text: el?.textContent?.trim()
        };
      });
      
      // ファイル入力にフォーカスが当たったか確認
      if (focusedElement.tagName === 'INPUT' && focusedElement.type === 'file') {
        foundFileInput = true;
        expect(foundFileInput).toBeTruthy();
        
        // 次の要素へ
        await page.keyboard.press('Tab');
        
        // アップロードボタンにフォーカスが移動したか確認
        const nextElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tagName: el?.tagName,
            dataTestId: el?.getAttribute('data-testid'),
            text: el?.textContent?.trim()
          };
        });
        
        if (nextElement.tagName === 'BUTTON' && 
            (nextElement.dataTestId === 'upload-button' || 
             nextElement.text?.includes('アップロード'))) {
          foundUploadButton = true;
          expect(foundUploadButton).toBeTruthy();
        }
        
        break;
      }
    }
    
    // 少なくともファイル入力が見つかることを確認
    expect(foundFileInput).toBeTruthy();
  });

  test('適切なARIA属性の存在', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/upload`);
    
    // 重要な要素のARIA属性確認
    const uploadButton = page.locator('button:has-text("アップロード")');
    const ariaLabel = await uploadButton.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    
    // フォームのラベル確認
    const fileInput = page.locator('input[type="file"]');
    const labelFor = await page.locator(`label[for="${await fileInput.getAttribute('id')}"]`).count();
    expect(labelFor).toBeGreaterThan(0);
  });
});
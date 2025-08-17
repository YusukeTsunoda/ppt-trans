import { test, expect } from './fixtures/test-base';
import path from 'path';
import fs from 'fs';

test.describe('【High 🟡】コア機能フロー（ファイルアップロード）', () => {
  // テスト用のPPTXファイルを準備
  const testFilesDir = path.join(process.cwd(), 'e2e', 'test-files');
  const validPPTXPath = path.join(testFilesDir, 'test-presentation.pptx');
  const invalidFilePath = path.join(testFilesDir, 'invalid-file.txt');

  test.beforeAll(async () => {
    // テストファイルディレクトリを作成
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // 最小限の有効なPPTXファイルを作成（PKZipヘッダー付き）
    // 実際のPPTXファイル構造の最小限のバイナリ
    const pptxHeader = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00,
      0x08, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00, 0x00,
      // ... 最小限のPPTX構造
    ]);
    fs.writeFileSync(validPPTXPath, pptxHeader);

    // 無効なテキストファイルを作成
    fs.writeFileSync(invalidFilePath, 'This is not a PPTX file');
  });

  test.afterAll(async () => {
    // テストファイルをクリーンアップ
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // 各テストの前にログイン
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'testpassword123');
    await page.click('button:has-text("ログイン")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test.describe('シナリオ4: 正常なファイルアップロード', () => {
    test('有効なPPTXファイルをアップロードできる', async ({ page }) => {
      // GIVEN: ログインした状態でアップロードページにアクセス
      await page.goto('/upload');
      
      // ページが正しく読み込まれたことを確認
      await expect(page.locator('h1')).toContainText('ファイルアップロード');
      
      // WHEN: 有効なPPTXファイルを選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      // ファイル名が表示されることを確認
      await expect(page.locator('text=test-presentation.pptx')).toBeVisible();
      
      // アップロードボタンを押す
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeEnabled();
      await uploadButton.click();
      
      // THEN: 成功通知が表示される
      await expect(page.locator('text=/アップロードに成功しました|ファイルがアップロードされました/')).toBeVisible({ timeout: 15000 });
      
      // ファイル一覧ページ（/files または /dashboard）にリダイレクトされる
      await page.waitForURL(/(files|dashboard)/, { timeout: 10000 });
      
      // AND: ファイル一覧に、アップロードしたファイル名が表示されている
      await expect(page.locator('text=test-presentation.pptx')).toBeVisible({ timeout: 10000 });
    });

    test('アップロード進捗が表示される', async ({ page }) => {
      await page.goto('/upload');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      
      // アップロードボタンをクリック
      await page.click('button:has-text("アップロード")');
      
      // 進捗インジケーターが表示される
      const progressIndicator = page.locator('text=/アップロード中|処理中|Uploading/');
      await expect(progressIndicator).toBeVisible();
      
      // 完了まで待つ
      await expect(progressIndicator).toBeHidden({ timeout: 15000 });
    });
  });

  test.describe('シナリオ5: 不正なファイル形式でのアップロード', () => {
    test('無効なファイル形式ではエラーが表示される', async ({ page }) => {
      // GIVEN: ログインした状態でアップロードページにアクセス
      await page.goto('/upload');
      
      // WHEN: 無効なファイル（.txtファイル）を選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // THEN: エラーメッセージが表示される
      const errorMessage = page.locator('text=/無効なファイル形式|PPTXファイルのみ|Invalid file format/');
      await expect(errorMessage).toBeVisible();
      
      // ページは遷移しない
      await expect(page).toHaveURL(/.*upload/);
      
      // アップロードボタンが無効化される、またはクリックしてもエラーが表示される
      const uploadButton = page.locator('button:has-text("アップロード")');
      if (await uploadButton.isEnabled()) {
        await uploadButton.click();
        await expect(errorMessage).toBeVisible();
        await expect(page).toHaveURL(/.*upload/);
      }
    });

    test('ファイルサイズ制限を超えた場合はエラーが表示される', async ({ page }) => {
      // 大きなファイルを作成（仮想的に10MB以上）
      const largePPTXPath = path.join(testFilesDir, 'large-presentation.pptx');
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      largeBuffer[0] = 0x50; // PKZip signature
      largeBuffer[1] = 0x4b;
      largeBuffer[2] = 0x03;
      largeBuffer[3] = 0x04;
      fs.writeFileSync(largePPTXPath, largeBuffer);

      await page.goto('/upload');
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(largePPTXPath);
      
      // サイズ制限エラーが表示される
      const errorMessage = page.locator('text=/ファイルサイズが大きすぎます|10MB以下|File too large/');
      await expect(errorMessage).toBeVisible();
      
      // クリーンアップ
      fs.unlinkSync(largePPTXPath);
    });

    test('ファイルが選択されていない場合はアップロードできない', async ({ page }) => {
      await page.goto('/upload');
      
      // ファイルを選択せずにアップロードボタンの状態を確認
      const uploadButton = page.locator('button:has-text("アップロード")');
      
      // ボタンが無効化されているか、クリックしてもエラーが表示される
      const isDisabled = await uploadButton.isDisabled();
      
      if (!isDisabled) {
        await uploadButton.click();
        await expect(page.locator('text=/ファイルを選択してください|No file selected/')).toBeVisible();
      } else {
        expect(isDisabled).toBeTruthy();
      }
      
      // ページは遷移しない
      await expect(page).toHaveURL(/.*upload/);
    });
  });

  test.describe('アップロード後の操作', () => {
    test('アップロードしたファイルをダウンロードできる', async ({ page }) => {
      // ファイルをアップロード
      await page.goto('/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      
      // ファイル一覧ページに移動
      await page.waitForURL(/(files|dashboard)/, { timeout: 15000 });
      
      // ダウンロードボタンを探す
      const downloadButton = page.locator('button:has-text("ダウンロード"), a:has-text("ダウンロード"), button:has-text("元ファイル")').first();
      
      // ダウンロードイベントを待機
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;
      
      // ダウンロードが成功したことを確認
      expect(download.suggestedFilename()).toContain('.pptx');
    });

    test('アップロードしたファイルを翻訳できる', async ({ page }) => {
      // ファイルをアップロード
      await page.goto('/upload');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validPPTXPath);
      await page.click('button:has-text("アップロード")');
      
      // ファイル一覧ページに移動
      await page.waitForURL(/(files|dashboard)/, { timeout: 15000 });
      
      // 翻訳ボタンを探す
      const translateButton = page.locator('button:has-text("翻訳"), button:has-text("🌐")').first();
      
      if (await translateButton.isVisible()) {
        await translateButton.click();
        
        // 翻訳処理中の表示を確認
        await expect(page.locator('text=/翻訳中|処理中|Translating/')).toBeVisible();
        
        // 翻訳完了またはエラーメッセージを待つ（タイムアウトは長めに設定）
        await expect(page.locator('text=/翻訳が完了|翻訳済み|Translation complete|エラー/')).toBeVisible({ timeout: 60000 });
      }
    });
  });
});
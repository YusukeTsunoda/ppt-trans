import { test, expect, TEST_USER } from './fixtures/test-base';
import { join } from 'path';
import * as fs from 'fs';

/**
 * アップロードフロー統合テスト
 * upload関連のすべてのテストを統合
 */
test.describe('アップロードフロー統合テスト', () => {
  const testFilesDir = join(process.cwd(), 'e2e', 'fixtures');
  const validPPTXPath = join(testFilesDir, 'test-presentation.pptx');
  const invalidFilePath = join(testFilesDir, 'invalid-file.txt');

  test.beforeAll(async () => {
    // テストファイルの存在確認
    if (!fs.existsSync(validPPTXPath)) {
      throw new Error(`テストファイルが見つかりません: ${validPPTXPath}`);
    }
  });

  test.beforeEach(async ({ page, baseURL }) => {
    // ログイン
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
  });

  test.describe('正常系：ファイルアップロード', () => {
    test('有効なPPTXファイルをアップロードできる', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // ページ要素の確認（必須）
      const pageTitle = page.locator('h1').filter({ hasText: /PowerPoint|アップロード/i });
      await expect(pageTitle).toBeVisible({
        timeout: 10000,
        message: 'アップロードページが正しく表示されていません'
      });
      
      // ファイル選択
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible({
        timeout: 5000,
        message: 'ファイル入力要素が表示されていません'
      });
      await fileInput.setInputFiles(validPPTXPath);
      
      // ファイル名表示の確認（必須）
      await expect(page.locator('text=/test.*\.pptx/i')).toBeVisible({
        timeout: 5000,
        message: '選択したファイル名が表示されていません'
      });
      
      // アップロードボタンの状態確認（必須）
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeEnabled({
        timeout: 5000,
        message: 'アップロードボタンが有効になっていません'
      });
      
      // アップロード実行
      await uploadButton.click();
      
      // 成功確認（必須：成功メッセージまたはダッシュボードへのリダイレクト）
      // 改善: OR条件を明示的なアサーションに変更
      const successMessage = page.locator('text=/正常にアップロード|successfully/i');
      const dashboardUrl = page.url();
      
      // いずれかの成功条件を満たすことを保証
      await expect(async () => {
        const hasMessage = await successMessage.count() > 0;
        const isOnDashboard = dashboardUrl.includes('dashboard');
        
        // 少なくとも1つの成功条件を満たす必要がある
        const isSuccess = hasMessage || isOnDashboard;
        
        expect(isSuccess).toBeTruthy();
        return isSuccess;
      }).toPass({
        timeout: 15000,
        intervals: [1000, 2000, 3000],
        message: 'アップロード成功の指標（成功メッセージまたはダッシュボード遷移）が確認できません'
      });
    });

    test('アップロード後にファイルが一覧に表示される', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // アップロード済みファイルの確認（必須）
      const fileList = page.locator('tr, li').filter({ hasText: /\.pptx/i });
      await expect(fileList.first()).toBeVisible({
        timeout: 10000,
        message: 'アップロードしたファイルが一覧に表示されていません'
      });
      
      // アクションボタンの確認（必須）
      const actionButtons = fileList.first().locator('button, a').filter({
        hasText: /プレビュー|翻訳|ダウンロード|削除/i
      });
      await expect(actionButtons.first()).toBeVisible({
        timeout: 5000,
        message: 'ファイルアクションボタンが表示されていません'
      });
    });
  });

  test.describe('異常系：バリデーション', () => {
    test('無効なファイル形式はアップロードできない', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 無効なファイルを作成
      if (!fs.existsSync(invalidFilePath)) {
        fs.writeFileSync(invalidFilePath, 'This is not a PPTX file');
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // エラーメッセージの表示（必須）
      await expect(page.locator('text=/PowerPointファイル.*のみ|only.*PowerPoint/i')).toBeVisible({
        timeout: 5000,
        message: 'ファイル形式エラーが表示されていません'
      });
      
      // アップロードボタンが無効化（必須）
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled({
        timeout: 5000,
        message: 'アップロードボタンが無効化されていません'
      });
    });

    test('ファイル未選択ではアップロードできない', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // アップロードボタンの初期状態（必須：無効化）
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled({
        timeout: 5000,
        message: 'ファイル未選択時にアップロードボタンが有効になっています'
      });
    });

    test('ファイルサイズ制限の確認', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // ファイルサイズ制限の表示（必須）
      await expect(page.locator('text=/最大.*100.*MB|Max.*100.*MB/i')).toBeVisible({
        timeout: 5000,
        message: 'ファイルサイズ制限が表示されていません'
      });
      
      // accept属性の確認（必須）
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toHaveAttribute('accept', '.ppt,.pptx', {
        timeout: 5000,
        message: 'ファイル形式制限が設定されていません'
      });
    });
  });

  test.describe('TDD：アップロードボタンの状態管理', () => {
    test('ファイル選択後にバリデーションエラーでボタンが無効化される', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 無効なファイルを選択
      if (!fs.existsSync(invalidFilePath)) {
        fs.writeFileSync(invalidFilePath, 'Invalid content');
      }
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);
      
      // エラー表示とボタン無効化の確認（必須）
      await expect(page.locator('text=/PowerPointファイル.*のみ/i')).toBeVisible({
        timeout: 5000,
        message: 'エラーメッセージが表示されていません'
      });
      
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeDisabled({
        timeout: 5000,
        message: 'エラー時にボタンが無効化されていません'
      });
      
      // 有効なファイルに変更
      await fileInput.setInputFiles(validPPTXPath);
      
      // エラーが消えてボタンが有効化（必須）
      await expect(page.locator('text=/PowerPointファイル.*のみ/i')).toBeHidden({
        timeout: 5000,
        message: 'エラーメッセージが消えていません'
      });
      
      await expect(uploadButton).toBeEnabled({
        timeout: 5000,
        message: '有効なファイル選択後にボタンが有効化されていません'
      });
    });
  });

  test.afterAll(async () => {
    // テストファイルのクリーンアップ
    if (fs.existsSync(invalidFilePath)) {
      fs.unlinkSync(invalidFilePath);
    }
  });
});
import { test } from '../fixtures/pages';
import { expect } from '@playwright/test';
import { join } from 'path';
import * as fs from 'fs';

/**
 * Page Object Modelベースのアップロードテスト
 * よりメンテナブルで実装に依存しないテスト構造
 */
test.describe('POM: アップロードフロー', () => {
  const testFilesDir = join(process.cwd(), 'e2e', 'fixtures');
  const validPPTXPath = join(testFilesDir, 'test-presentation.pptx');
  const invalidFilePath = join(testFilesDir, 'invalid-file.txt');
  
  // テストファイルの事前検証
  test.beforeAll(async () => {
    if (!fs.existsSync(validPPTXPath)) {
      throw new Error(`テストファイルが存在しません: ${validPPTXPath}`);
    }
  });

  test.describe('認証済みユーザーのアップロード', () => {
    test('完全なアップロードフロー', async ({ 
      uploadPage, 
      dashboardPage, 
      authenticatedUser 
    }) => {
      // 前提条件の確認
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // アップロードページへ遷移
      await uploadPage.goto();
      
      // ファイル選択とアップロード
      await uploadPage.selectFile(validPPTXPath);
      
      // ファイル名が表示されていることを確認
      const fileName = await uploadPage.getSelectedFileName();
      expect(fileName).toContain('test-presentation.pptx');
      
      // アップロードボタンが有効になっていることを確認
      expect(await uploadPage.isUploadButtonEnabled()).toBeTruthy();
      
      // アップロード実行
      await uploadPage.clickUpload();
      await uploadPage.waitForSuccess();
      
      // ダッシュボードでファイル確認
      await dashboardPage.goto();
      const hasFile = await dashboardPage.hasFile('test-presentation.pptx');
      expect(hasFile).toBeTruthy();
      
      // クリーンアップ
      await dashboardPage.deleteFile('test-presentation.pptx');
    });

    test('無効なファイル形式の拒否', async ({ uploadPage }) => {
      await uploadPage.goto();
      
      // 無効なファイルを作成
      if (!fs.existsSync(invalidFilePath)) {
        fs.writeFileSync(invalidFilePath, 'This is not a PPTX file');
      }
      
      // ファイル選択
      await uploadPage.selectFile(invalidFilePath);
      
      // エラーメッセージの確認
      const errorMessage = await uploadPage.getErrorMessage();
      expect(errorMessage).toContain('PowerPointファイル');
      
      // アップロードボタンが無効化されていることを確認
      expect(await uploadPage.isUploadButtonDisabled()).toBeTruthy();
      
      // クリーンアップ
      if (fs.existsSync(invalidFilePath)) {
        fs.unlinkSync(invalidFilePath);
      }
    });

    test('ファイルサイズ表示の検証', async ({ uploadPage }) => {
      await uploadPage.goto();
      
      // ファイル選択
      await uploadPage.selectFile(validPPTXPath);
      
      // ファイルサイズが表示されていることを確認
      const fileSize = await uploadPage.getFileSize();
      expect(fileSize).toBeTruthy();
      expect(fileSize).toMatch(/\d+(\.\d+)?\s*(B|KB|MB)/);
    });
  });

  test.describe('アクセシビリティ', () => {
    test('キーボードナビゲーション', async ({ uploadPage, authenticatedUser }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // キーボードナビゲーションのテスト
      const canNavigate = await uploadPage.testKeyboardNavigation();
      expect(canNavigate).toBeTruthy();
    });

    test('ARIA属性の検証', async ({ uploadPage, authenticatedUser }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // ARIA属性の検証
      const accessibility = await uploadPage.verifyAccessibility();
      
      expect(accessibility.hasAriaLabel).toBeTruthy();
      expect(accessibility.hasAriaDescribedBy).toBeTruthy();
      expect(accessibility.formHasLabel).toBeTruthy();
    });
  });

  test.describe('エラーリカバリー', () => {
    test('ファイル選択のクリアと再選択', async ({ uploadPage, authenticatedUser }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // 最初のファイル選択
      await uploadPage.selectFile(validPPTXPath);
      let fileName = await uploadPage.getSelectedFileName();
      expect(fileName).toContain('test-presentation.pptx');
      
      // ファイル選択をクリア
      await uploadPage.clearFileSelection();
      
      // ファイル名が消えていることを確認
      fileName = await uploadPage.getSelectedFileName();
      expect(fileName).toBeFalsy();
      
      // 再選択
      await uploadPage.selectFile(validPPTXPath);
      fileName = await uploadPage.getSelectedFileName();
      expect(fileName).toContain('test-presentation.pptx');
    });
  });
});
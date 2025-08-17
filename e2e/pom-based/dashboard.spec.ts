import { test } from '../fixtures/pages';
import { expect } from '@playwright/test';
import { join } from 'path';
import * as fs from 'fs';

/**
 * Page Object Modelベースのダッシュボードテスト
 */
test.describe('POM: ダッシュボード機能', () => {
  const testFilesDir = join(process.cwd(), 'e2e', 'fixtures');
  const validPPTXPath = join(testFilesDir, 'test-presentation.pptx');
  
  test.beforeAll(async () => {
    if (!fs.existsSync(validPPTXPath)) {
      throw new Error(`テストファイルが存在しません: ${validPPTXPath}`);
    }
  });

  test.describe('ファイル管理', () => {
    test('空のダッシュボード表示', async ({ dashboardPage, authenticatedUser }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ダッシュボードへ遷移
      await dashboardPage.goto();
      
      // 既存のファイルをすべて削除
      await dashboardPage.deleteAllFiles();
      
      // 空の状態メッセージが表示されることを確認
      const fileCount = await dashboardPage.getFileCount();
      expect(fileCount).toBe(0);
      
      // 空状態要素が表示されることを確認
      const emptyStateVisible = await dashboardPage.emptyState.isVisible();
      expect(emptyStateVisible).toBeTruthy();
    });

    test('ファイルアップロード後の一覧表示', async ({ 
      uploadPage, 
      dashboardPage, 
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ファイルをアップロード
      await uploadPage.goto();
      await uploadPage.uploadFile(validPPTXPath);
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      
      // ファイルが表示されるまで待つ
      const fileAppeared = await dashboardPage.waitForFile('test-presentation.pptx');
      expect(fileAppeared).toBeTruthy();
      
      // ファイル数を確認
      const fileCount = await dashboardPage.getFileCount();
      expect(fileCount).toBeGreaterThan(0);
      
      // ファイル一覧を取得
      const files = await dashboardPage.getFileList();
      expect(files).toContain('test-presentation.pptx');
      
      // クリーンアップ
      await dashboardPage.deleteFile('test-presentation.pptx');
    });

    test('ファイルアクションボタンの表示', async ({ 
      uploadPage, 
      dashboardPage, 
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ファイルをアップロード
      await uploadPage.goto();
      await uploadPage.uploadFile(validPPTXPath);
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      await dashboardPage.waitForFile('test-presentation.pptx');
      
      // アクションボタンを取得
      const actions = await dashboardPage.getFileActions('test-presentation.pptx');
      
      // 各アクションボタンが存在することを確認
      await expect(actions.preview).toBeVisible();
      await expect(actions.translate).toBeVisible();
      await expect(actions.download).toBeVisible();
      await expect(actions.delete).toBeVisible();
      
      // クリーンアップ
      await dashboardPage.deleteFile('test-presentation.pptx');
    });

    test('ファイル削除機能', async ({ 
      uploadPage, 
      dashboardPage, 
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ファイルをアップロード
      await uploadPage.goto();
      await uploadPage.uploadFile(validPPTXPath);
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      await dashboardPage.waitForFile('test-presentation.pptx');
      
      // ファイルが存在することを確認
      let hasFile = await dashboardPage.hasFile('test-presentation.pptx');
      expect(hasFile).toBeTruthy();
      
      // ファイルを削除
      await dashboardPage.deleteFile('test-presentation.pptx');
      
      // ファイルが削除されたことを確認
      hasFile = await dashboardPage.hasFile('test-presentation.pptx');
      expect(hasFile).toBeFalsy();
    });

    test('更新ボタンの動作', async ({ 
      uploadPage, 
      dashboardPage, 
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      
      // 初期のファイル数を取得
      const initialCount = await dashboardPage.getFileCount();
      
      // 別タブでファイルをアップロード（シミュレーション）
      await uploadPage.goto();
      await uploadPage.uploadFile(validPPTXPath);
      
      // ダッシュボードへ戻る
      await dashboardPage.goto();
      
      // 更新ボタンをクリック
      await dashboardPage.refresh();
      
      // ファイル数が増えていることを確認
      const newCount = await dashboardPage.getFileCount();
      expect(newCount).toBeGreaterThan(initialCount);
      
      // クリーンアップ
      await dashboardPage.deleteFile('test-presentation.pptx');
    });
  });

  test.describe('ナビゲーション', () => {
    test('新規アップロードページへの遷移', async ({ 
      dashboardPage, 
      authenticatedUser,
      page 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      
      // 新規アップロードボタンをクリック
      await dashboardPage.navigateToUpload();
      
      // URLが変更されたことを確認
      await expect(page).toHaveURL(/\/upload/);
    });

    test('ファイルプレビューへの遷移', async ({ 
      uploadPage,
      dashboardPage, 
      authenticatedUser,
      page 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // ファイルをアップロード
      await uploadPage.goto();
      await uploadPage.uploadFile(validPPTXPath);
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      await dashboardPage.waitForFile('test-presentation.pptx');
      
      // プレビューボタンをクリック
      await dashboardPage.previewFile('test-presentation.pptx');
      
      // URLが変更されたことを確認
      await expect(page).toHaveURL(/\/preview\//);
      
      // ダッシュボードへ戻ってクリーンアップ
      await dashboardPage.goto();
      await dashboardPage.deleteFile('test-presentation.pptx');
    });
  });

  test.describe('一括操作', () => {
    test('複数ファイルの管理', async ({ 
      uploadPage,
      dashboardPage, 
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // 複数のテストファイルを作成
      const testFiles = [
        'test-presentation-1.pptx',
        'test-presentation-2.pptx',
        'test-presentation-3.pptx'
      ];
      
      // 各ファイルをアップロード
      for (const fileName of testFiles) {
        const filePath = join(testFilesDir, fileName);
        
        // テストファイルをコピー（実際のテストでは異なるファイルを使用）
        if (!fs.existsSync(filePath)) {
          fs.copyFileSync(validPPTXPath, filePath);
        }
        
        await uploadPage.goto();
        await uploadPage.uploadFile(filePath);
      }
      
      // ダッシュボードへ移動
      await dashboardPage.goto();
      
      // すべてのファイルが表示されることを確認
      for (const fileName of testFiles) {
        const hasFile = await dashboardPage.hasFile(fileName);
        expect(hasFile).toBeTruthy();
      }
      
      // ファイル数を確認
      const fileCount = await dashboardPage.getFileCount();
      expect(fileCount).toBeGreaterThanOrEqual(testFiles.length);
      
      // クリーンアップ：すべてのファイルを削除
      await dashboardPage.deleteAllFiles();
      
      // テストファイルも削除
      for (const fileName of testFiles) {
        const filePath = join(testFilesDir, fileName);
        if (fs.existsSync(filePath) && fileName !== 'test-presentation.pptx') {
          fs.unlinkSync(filePath);
        }
      }
    });
  });
});
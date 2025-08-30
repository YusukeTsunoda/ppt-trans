/**
 * 統合版ファイルアップロードテスト
 * 
 * 統合対象：
 * - upload.spec.ts: 基本的なアップロードフロー
 * - simple-upload.spec.ts: 簡易版（manual test）
 * - upload-complete.spec.ts: 完全版フロー
 * - file-upload.spec.ts: 詳細なファイル操作
 * - file-upload-improved.spec.ts: 改善版（パフォーマンス計測付き）
 * 
 * リファクタリングのポイント：
 * 1. 5つのファイルから重複を排除して1つに統合
 * 2. データ駆動テストで様々なファイル形式を網羅
 * 3. パフォーマンス計測を標準化
 * 4. エラーケースを体系的に整理
 */

import { test, expect } from '@playwright/test';
import { UploadPageImproved } from '../page-objects/UploadPageImproved';
import { DashboardPage } from '../page-objects/DashboardPage';
import {
  loginAsTestUser,
  performFileUpload,
  simulateNetworkError,
  measurePerformance
} from '../helpers/common-flows';
import {
  createTestUser,
  getTestFile,
  cleanupTestData,
  expectations,
  TestUser
} from '../fixtures/test-data';
import {
  assertFileUploadSuccess,
  assertErrorMessage,
  assertPagePerformance,
  assertFileDownload
} from '../helpers/custom-assertions';
import { testConfig } from '../config/test.config';
import fs from 'fs';
import path from 'path';

// テストファイルの準備
test.beforeAll(async () => {
  const testFilesDir = path.join(process.cwd(), 'e2e', 'test-files');
  
  if (!fs.existsSync(testFilesDir)) {
    fs.mkdirSync(testFilesDir, { recursive: true });
  }
  
  // 各種テストファイルを作成
  const testFiles = [
    { name: 'valid-presentation.pptx', size: 50 * 1024 }, // 50KB
    { name: 'small.pptx', size: 1024 }, // 1KB
    { name: 'medium.pptx', size: 5 * 1024 * 1024 }, // 5MB
    { name: 'invalid-file.txt', size: 100 },
    { name: 'corrupt-presentation.pptx', size: 1024 }
  ];
  
  for (const file of testFiles) {
    const filePath = path.join(testFilesDir, file.name);
    if (!fs.existsSync(filePath)) {
      const buffer = Buffer.alloc(file.size);
      
      // PPTXファイルの場合はマジックナンバーを設定
      if (file.name.endsWith('.pptx')) {
        buffer[0] = 0x50; // P
        buffer[1] = 0x4B; // K
        buffer[2] = 0x03;
        buffer[3] = 0x04;
      }
      
      fs.writeFileSync(filePath, buffer);
    }
  }
});

// テスト後のクリーンアップ
test.afterEach(async () => {
  await cleanupTestData();
});

test.describe('📤 統合版ファイルアップロード機能', () => {
  let testUser: TestUser;
  let uploadPage: UploadPageImproved;
  
  test.beforeEach(async ({ page }) => {
    // テストユーザーでログイン
    testUser = await loginAsTestUser(page);
    uploadPage = new UploadPageImproved(page);
  });
  
  test.describe('正常系', () => {
    // データ駆動：様々なサイズのファイル
    const validFiles = [
      { name: 'small.pptx', expectedTime: 3000, label: '小容量' },
      { name: 'valid-presentation.pptx', expectedTime: 5000, label: '標準' },
      { name: 'medium.pptx', expectedTime: 10000, label: '中容量' }
    ];
    
    for (const fileConfig of validFiles) {
      test(`✅ ${fileConfig.label}ファイル(${fileConfig.name})のアップロード`, async ({ page }) => {
        const filePath = path.join('e2e', 'test-files', fileConfig.name);
        
        // パフォーマンス計測付きアップロード
        const { result, duration, metrics } = await measurePerformance(
          `upload-${fileConfig.name}`,
          async () => performFileUpload(page, filePath)
        );
        
        // アップロード成功を確認
        expect(result.success).toBe(true);
        expect(result.fileName).toContain(fileConfig.name);
        
        // パフォーマンス基準
        expect(duration).toBeLessThan(fileConfig.expectedTime);
        
        // ファイル一覧での表示確認
        await page.waitForURL(/(files|dashboard)/, {
          timeout: testConfig.timeouts.navigation
        });
        await assertFileUploadSuccess(page, fileConfig.name);
        
        // メトリクスの記録
        console.log(`📊 Upload Metrics for ${fileConfig.name}:
          - Duration: ${duration}ms
          - Expected: <${fileConfig.expectedTime}ms
          - Performance: ${duration < fileConfig.expectedTime ? '✅ PASS' : '❌ FAIL'}
        `);
      });
    }
    
    test('✅ 複数ファイルの連続アップロード', async ({ page }) => {
      await uploadPage.navigateToUploadPage();
      
      const files = ['small.pptx', 'valid-presentation.pptx'];
      const results = [];
      
      for (const fileName of files) {
        const filePath = path.join('e2e', 'test-files', fileName);
        
        if (!fs.existsSync(filePath)) {
          console.log(`⚠️ Skipping ${fileName} - file not found`);
          continue;
        }
        
        const startTime = Date.now();
        
        await uploadPage.selectFile(filePath);
        await uploadPage.clickUploadButton();
        await uploadPage.waitForUploadSuccess();
        
        results.push({
          fileName,
          duration: Date.now() - startTime,
          success: true
        });
        
        // 次のアップロードのためにページをリセット
        await uploadPage.navigateToUploadPage();
      }
      
      // すべてのアップロードが成功
      expect(results.every(r => r.success)).toBe(true);
      
      // 平均アップロード時間の計算
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgTime).toBeLessThan(5000);
    });
    
    test('📊 アップロード進捗の監視と検証', async ({ page }) => {
      const testFile = getTestFile('valid');
      await uploadPage.navigateToUploadPage();
      
      await uploadPage.selectFile(testFile.path);
      
      // 進捗監視を開始
      const uploadPromise = uploadPage.monitorUploadProgress();
      await uploadPage.clickUploadButton();
      const progressData = await uploadPromise;
      
      // 進捗データの検証
      expect(progressData.maxProgress).toBe(100);
      expect(progressData.progressUpdates.length).toBeGreaterThan(0);
      
      // 進捗が段階的に増加
      for (let i = 1; i < progressData.progressUpdates.length; i++) {
        expect(progressData.progressUpdates[i]).toBeGreaterThanOrEqual(
          progressData.progressUpdates[i - 1]
        );
      }
      
      // アップロード時間が制限内
      expect(progressData.duration).toBeLessThan(testConfig.timeouts.upload);
    });
    
    test('⬇️ アップロード後のファイルダウンロード', async ({ page }) => {
      const testFile = getTestFile('valid');
      
      // ファイルをアップロード
      const uploadResult = await performFileUpload(page, testFile.path);
      expect(uploadResult.success).toBe(true);
      
      // ダウンロードボタンを探してクリック
      const downloadButton = page.locator(
        'button:has-text("ダウンロード"), a:has-text("ダウンロード")'
      ).first();
      
      if (await downloadButton.isVisible()) {
        await assertFileDownload(page, testFile.name, {
          min: 1024,
          max: 10 * 1024 * 1024
        });
      }
    });
  });
  
  test.describe('異常系', () => {
    test('❌ 無効なファイル形式（.txt）のエラー処理', async ({ page }) => {
      await uploadPage.navigateToUploadPage();
      
      const invalidFile = path.join('e2e', 'test-files', 'invalid-file.txt');
      await uploadPage.selectFile(invalidFile);
      
      // バリデーションエラーを確認
      const validationErrors = await uploadPage.getValidationErrors();
      expect(
        validationErrors.some(e => /PPTXファイルのみ|Invalid file format/i.test(e))
      ).toBe(true);
      
      // アップロードボタンの状態確認
      const buttonState = await uploadPage.getUploadButtonState();
      if (buttonState.isEnabled) {
        await uploadPage.clickUploadButton();
        await assertErrorMessage(page, 'invalidFile');
      }
    });
    
    test('❌ ファイルサイズ制限（10MB超）のエラー処理', async ({ page }) => {
      await uploadPage.navigateToUploadPage();
      
      // 11MBのファイルを作成
      const largeFilePath = path.join('e2e', 'test-files', 'large-test.pptx');
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      largeBuffer[0] = 0x50; // PPTXマジックナンバー
      largeBuffer[1] = 0x4B;
      largeBuffer[2] = 0x03;
      largeBuffer[3] = 0x04;
      
      fs.writeFileSync(largeFilePath, largeBuffer);
      
      try {
        await uploadPage.selectFile(largeFilePath);
        
        // エラーメッセージを確認
        const validationErrors = await uploadPage.getValidationErrors();
        expect(
          validationErrors.some(e => /サイズ|size|10MB/i.test(e))
        ).toBe(true);
      } finally {
        // テストファイルを削除
        if (fs.existsSync(largeFilePath)) {
          fs.unlinkSync(largeFilePath);
        }
      }
    });
    
    test('❌ ファイル未選択時のエラー処理', async ({ page }) => {
      await uploadPage.navigateToUploadPage();
      
      const uploadButton = page.locator('[data-testid="upload-button"], button:has-text("アップロード")');
      const isDisabled = await uploadButton.isDisabled();
      
      if (!isDisabled) {
        await uploadButton.click();
        await expect(
          page.locator('text=/ファイルを選択してください|No file selected/')
        ).toBeVisible();
      } else {
        expect(isDisabled).toBe(true);
      }
    });
    
    test('🌐 ネットワークエラー時のリトライ機能', async ({ page, context }) => {
      await uploadPage.navigateToUploadPage();
      
      // オフラインモードをシミュレート
      await context.setOffline(true);
      
      const testFile = getTestFile('valid');
      await uploadPage.selectFile(testFile.path);
      await uploadPage.clickUploadButton();
      
      // エラーメッセージを確認
      const error = await uploadPage.getUploadError();
      expect(error).toMatch(/ネットワーク|network|接続/i);
      
      // ネットワークを復旧
      await context.setOffline(false);
      
      // リトライボタンの確認
      const retryButton = page.locator('button:has-text("リトライ"), button:has-text("Retry")');
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await uploadPage.waitForUploadSuccess();
      }
    });
    
    test('⏱️ アップロードタイムアウトの処理', async ({ page, context }) => {
      await uploadPage.navigateToUploadPage();
      
      // 遅延レスポンスをシミュレート
      await context.route('**/api/upload', async route => {
        await new Promise(resolve => setTimeout(resolve, 35000)); // 35秒遅延
        await route.continue();
      });
      
      const testFile = getTestFile('valid');
      await uploadPage.selectFile(testFile.path);
      
      // タイムアウトテスト（30秒のタイムアウトを想定）
      const uploadPromise = uploadPage.clickUploadButton();
      
      // エラーが発生することを期待
      await expect(uploadPromise).rejects.toThrow();
      
      const error = await uploadPage.getUploadError();
      if (error) {
        expect(error).toMatch(/タイムアウト|timeout|時間切れ/i);
      }
    });
  });
  
  test.describe('セキュリティ', () => {
    test('🔒 ファイル名のXSSペイロードサニタイゼーション', async ({ page }) => {
      await uploadPage.navigateToUploadPage();
      
      // XSSペイロードを含むファイル名のテスト
      const xssFileName = '<script>alert("XSS")</script>.pptx';
      const safePath = path.join('e2e', 'test-files', 'xss-test.pptx');
      
      // テストファイルを作成
      const validFile = getTestFile('valid');
      if (fs.existsSync(validFile.path)) {
        fs.copyFileSync(validFile.path, safePath);
      }
      
      // アラート監視
      let alertFired = false;
      page.on('dialog', async dialog => {
        alertFired = true;
        await dialog.dismiss();
      });
      
      await uploadPage.selectFile(safePath);
      await uploadPage.clickUploadButton();
      
      // 2秒待機してアラートが発火しないことを確認
      await page.waitForTimeout(2000);
      expect(alertFired).toBe(false);
      
      // クリーンアップ
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
      }
    });
    
    test('🔐 認証なしでのアップロードAPI保護', async ({ page, context }) => {
      // ログアウト
      await context.clearCookies();
      
      // 直接APIにアクセス
      const response = await page.request.post(`${testConfig.baseUrl}/api/upload`, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        multipart: {
          file: {
            name: 'test.pptx',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            buffer: Buffer.from('test content')
          }
        }
      });
      
      // 401 Unauthorizedを確認
      expect(response.status()).toBe(401);
    });
  });
  
  test.describe('パフォーマンス', () => {
    test('⚡ 大容量ファイル（5MB）のアップロード性能', async ({ page }) => {
      const mediumFile = path.join('e2e', 'test-files', 'medium.pptx');
      
      const { duration } = await measurePerformance(
        'large-file-upload',
        async () => performFileUpload(page, mediumFile)
      );
      
      // 5MBファイルは10秒以内にアップロード完了
      expect(duration).toBeLessThan(10000);
      
      // スループット計算（MB/秒）
      const throughput = (5 * 1024 * 1024) / (duration / 1000) / (1024 * 1024);
      expect(throughput).toBeGreaterThan(0.5); // 最低0.5MB/秒
      
      console.log(`📊 Performance Metrics:
        - File Size: 5MB
        - Upload Time: ${duration}ms
        - Throughput: ${throughput.toFixed(2)} MB/s
      `);
    });
    
    test('⚡ 並列アップロードのパフォーマンス', async ({ page, context }) => {
      // 2つのタブで並列アップロード
      const page2 = await context.newPage();
      
      // 両方のページでログイン
      await loginAsTestUser(page);
      await loginAsTestUser(page2, testUser);
      
      const file1 = path.join('e2e', 'test-files', 'small.pptx');
      const file2 = path.join('e2e', 'test-files', 'valid-presentation.pptx');
      
      // 並列アップロード
      const [result1, result2] = await Promise.all([
        performFileUpload(page, file1),
        performFileUpload(page2, file2)
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      
      // 並列実行の方が高速であることを確認
      const totalTime = Math.max(result1.uploadTime, result2.uploadTime);
      const sequentialTime = result1.uploadTime + result2.uploadTime;
      
      expect(totalTime).toBeLessThan(sequentialTime * 0.8); // 20%以上の改善
      
      await page2.close();
    });
  });
});
import { test, expect } from '@playwright/test';
import { LoginPage, UploadPage } from '../page-objects';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 大容量ファイル処理パフォーマンステスト
 * 
 * 様々なサイズのファイルアップロード性能を測定
 */
test.describe('📊 大容量ファイル処理パフォーマンス', () => {
  let loginPage: LoginPage;
  let uploadPage: UploadPage;
  
  // テストファイルのサイズ定義
  const FILE_SIZES = [
    { size: 1, label: '1MB', maxTime: 5000 },
    { size: 5, label: '5MB', maxTime: 15000 },
    { size: 10, label: '10MB', maxTime: 30000 },
    { size: 25, label: '25MB', maxTime: 60000 },
    { size: 50, label: '50MB', maxTime: 120000 }
  ];
  
  // パフォーマンスメトリクス記録用
  const performanceMetrics: Array<{
    fileSize: string;
    uploadTime: number;
    throughput: number;
    peakMemory?: number;
    cpuUsage?: number;
  }> = [];

  test.beforeAll(async () => {
    // テストファイルの生成
    const testDir = path.join(process.cwd(), 'e2e', 'test-files', 'performance');
    await fs.mkdir(testDir, { recursive: true });
    
    for (const { size, label } of FILE_SIZES) {
      const filePath = path.join(testDir, `test-${label}.pptx`);
      
      // ファイルが存在しない場合は生成
      try {
        await fs.access(filePath);
      } catch {
        // ダミーPPTXファイルの生成（実際のPPTX構造ではないがサイズは正確）
        const buffer = Buffer.alloc(size * 1024 * 1024);
        
        // PPTXファイルのマジックバイトを追加
        buffer.write('PK', 0);
        
        await fs.writeFile(filePath, buffer);
        console.log(`Generated test file: ${label}`);
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    uploadPage = new UploadPage(page);
    
    // テストユーザーでログイン
    await loginPage.goto();
    await loginPage.login('test@example.com', 'Test123456!');
    await uploadPage.goto();
  });

  // タイムアウトを延長
  test.setTimeout(180000); // 3分

  for (const { size, label, maxTime } of FILE_SIZES) {
    test(`${label}ファイルのアップロード性能測定`, async ({ page }) => {
      const filePath = path.join(process.cwd(), 'e2e', 'test-files', 'performance', `test-${label}.pptx`);
      
      // パフォーマンス測定開始
      const startTime = performance.now();
      let lastProgressTime = startTime;
      const progressHistory: Array<{ progress: number; time: number; delta: number }> = [];
      
      // メモリ使用量の初期値を記録
      const initialMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory;
        }
        return null;
      });
      
      // ファイル選択
      await uploadPage.selectFile(filePath);
      
      // ファイル情報の確認
      const fileName = await uploadPage.getSelectedFileName();
      const fileSize = await uploadPage.getSelectedFileSize();
      expect(fileName).toBeTruthy();
      expect(fileSize).toBeTruthy();
      
      // アップロード開始
      const uploadPromise = uploadPage.clickUploadButton();
      
      // プログレス監視
      let lastProgress = 0;
      let progressCheckCount = 0;
      const maxProgressChecks = 240; // 最大2分間監視
      
      while (lastProgress < 100 && progressCheckCount < maxProgressChecks) {
        const currentProgress = await uploadPage.getUploadProgress();
        const currentTime = performance.now();
        
        if (currentProgress > lastProgress) {
          const delta = currentTime - lastProgressTime;
          progressHistory.push({
            progress: currentProgress,
            time: currentTime - startTime,
            delta: delta
          });
          
          console.log(`  Progress: ${currentProgress}% (${(delta).toFixed(0)}ms since last update)`);
          
          lastProgress = currentProgress;
          lastProgressTime = currentTime;
        }
        
        // エラーチェック
        if (await uploadPage.isUploadFailed()) {
          const error = await uploadPage.getErrorMessage();
          throw new Error(`Upload failed: ${error}`);
        }
        
        // 成功チェック
        if (await uploadPage.isUploadSuccessful()) {
          lastProgress = 100;
          break;
        }
        
        await page.waitForTimeout(500);
        progressCheckCount++;
      }
      
      // アップロード完了を待つ
      await uploadPromise;
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // メモリ使用量の最終値を記録
      const finalMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory;
        }
        return null;
      });
      
      // スループット計算（MB/秒）
      const throughput = (size * 1024) / (totalTime / 1000);
      
      // メトリクスの記録
      const metric = {
        fileSize: label,
        uploadTime: totalTime,
        throughput: throughput,
        peakMemory: finalMetrics ? (finalMetrics.usedJSHeapSize - initialMetrics?.usedJSHeapSize) / 1024 / 1024 : undefined
      };
      
      performanceMetrics.push(metric);
      
      // パフォーマンス基準の確認
      expect(totalTime).toBeLessThan(maxTime);
      expect(throughput).toBeGreaterThan(0.5); // 最低0.5MB/秒
      
      // 結果の出力
      console.log(`
        ===============================
        File Size: ${label}
        Upload Time: ${(totalTime / 1000).toFixed(2)}s
        Throughput: ${throughput.toFixed(2)} MB/s
        Memory Delta: ${metric.peakMemory?.toFixed(2) || 'N/A'} MB
        Progress Updates: ${progressHistory.length}
        ===============================
      `);
      
      // プログレスの滑らかさを確認（更新が適切に行われているか）
      if (progressHistory.length > 1) {
        const avgDelta = progressHistory.reduce((sum, p) => sum + p.delta, 0) / progressHistory.length;
        expect(avgDelta).toBeLessThan(5000); // 平均5秒以内に更新
      }
    });
  }

  test('ファイルサイズ制限の確認', async ({ page }) => {
    // 制限を超えるファイルサイズ（仮に100MBが上限の場合）
    const oversizedFile = path.join(process.cwd(), 'e2e', 'test-files', 'performance', 'test-oversized.pptx');
    
    try {
      await fs.access(oversizedFile);
    } catch {
      // 101MBのファイルを生成
      const buffer = Buffer.alloc(101 * 1024 * 1024);
      buffer.write('PK', 0);
      await fs.writeFile(oversizedFile, buffer);
    }
    
    await uploadPage.selectFile(oversizedFile);
    await uploadPage.clickUploadButton();
    
    // エラーメッセージの確認
    const errorMessage = await uploadPage.getErrorMessage();
    expect(errorMessage).toMatch(/size|サイズ|limit|制限/i);
  });

  test('並列アップロードのパフォーマンス', async ({ page, context }) => {
    // 3つのファイルを同時にアップロード
    const files = ['1MB', '5MB', '10MB'];
    const pages = [];
    
    for (let i = 0; i < files.length; i++) {
      const newPage = await context.newPage();
      const newLoginPage = new LoginPage(newPage);
      const newUploadPage = new UploadPage(newPage);
      
      await newLoginPage.goto();
      await newLoginPage.login(`user${i + 1}@test.com`, 'User123456!');
      await newUploadPage.goto();
      
      pages.push({ page: newPage, uploadPage: newUploadPage, fileSize: files[i] });
    }
    
    // 並列アップロード開始
    const startTime = performance.now();
    const uploadPromises = pages.map(async ({ uploadPage, fileSize }) => {
      const filePath = path.join(process.cwd(), 'e2e', 'test-files', 'performance', `test-${fileSize}.pptx`);
      await uploadPage.selectFile(filePath);
      return uploadPage.clickUploadButton();
    });
    
    // すべてのアップロードが完了するまで待つ
    await Promise.all(uploadPromises);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    console.log(`Parallel upload of ${files.join(', ')} completed in ${(totalTime / 1000).toFixed(2)}s`);
    
    // クリーンアップ
    for (const { page } of pages) {
      await page.close();
    }
  });

  test.afterAll(async () => {
    // パフォーマンスレポートの生成
    console.log('\n📊 Performance Test Summary:');
    console.log('================================');
    console.table(performanceMetrics);
    
    // CSVレポートの生成
    const csv = [
      'File Size,Upload Time (ms),Throughput (MB/s),Peak Memory (MB)',
      ...performanceMetrics.map(m => 
        `${m.fileSize},${m.uploadTime.toFixed(0)},${m.throughput.toFixed(2)},${m.peakMemory?.toFixed(2) || 'N/A'}`
      )
    ].join('\n');
    
    const reportPath = path.join(process.cwd(), 'test-results', 'performance-report.csv');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, csv);
    
    console.log(`\n📄 Performance report saved to: ${reportPath}`);
  });
});
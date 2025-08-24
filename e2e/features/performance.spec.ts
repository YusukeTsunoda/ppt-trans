import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';

/**
 * パフォーマンステスト - 追加機能テスト
 * アプリケーションのパフォーマンス基準を検証
 */
test.describe('パフォーマンス', () => {
  test.beforeEach(async ({ page }) => {
    // ログイン
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsStandardUser();
    await loginPage.expectLoginSuccess();
  });

  test('ページロード時間の測定', async ({ page, baseURL }) => {
    const pages = [
      { name: 'Dashboard', url: '/dashboard', maxTime: 3000 },
      { name: 'Upload', url: '/upload', maxTime: 2000 },
      { name: 'Profile', url: '/profile', maxTime: 2500 }
    ];

    for (const pageInfo of pages) {
      const startTime = Date.now();
      
      await page.goto(`${baseURL}${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // ページロード時間が基準以内であることを確認
      expect(loadTime).toBeLessThan(pageInfo.maxTime);
      
      // Core Web Vitalsの測定
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
        };
      });
      
      // First Contentful Paintが2秒以内
      expect(metrics.firstContentfulPaint).toBeLessThan(2000);
      
      console.log(`${pageInfo.name} Performance Metrics:`, {
        totalLoadTime: loadTime,
        ...metrics
      });
    }
  });

  test.skip('大容量ファイルのアップロード（10MB）', async ({ page, baseURL }) => {
    // ファイル作成が必要なためスキップ
    // 10MBのテストファイルを生成
    const largeFilePath = 'e2e/fixtures/test-files/large-10mb.pptx';
    
    // ファイル作成処理は削除（事前に配置されていることを前提とする）
    
    await page.goto(`${baseURL}/upload`);
    
    // アップロード時間を測定
    const startTime = Date.now();
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(largeFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    await uploadButton.click();
    
    // アップロード完了を待つ（最大60秒）
    await page.waitForURL('**/dashboard', { timeout: 60000 });
    
    const uploadTime = Date.now() - startTime;
    
    // 10MBファイルが60秒以内にアップロード完了
    expect(uploadTime).toBeLessThan(60000);
    
    console.log(`10MB File Upload Time: ${uploadTime}ms`);
    
    // アップロードされたファイルが表示されることを確認
    const fileRow = page.locator('tr:has-text("large-10mb.pptx")');
    await expect(fileRow).toBeVisible({ timeout: 5000 });
    
    // クリーンアップは不要（ファイル作成していないため）
  });

  test('複数スライドの翻訳パフォーマンス', async ({ page, baseURL }) => {
    // テストファイルをアップロード
    const testFilePath = 'e2e/fixtures/test-presentation.pptx';
    
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    // テキスト抽出完了を待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 翻訳時間を測定
    const startTime = Date.now();
    
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateAllButton = page.locator('button:has-text("すべて翻訳")');
    await translateAllButton.click();
    
    // 翻訳完了を待つ（最大2分）
    await expect(page.locator('text=/翻訳が完了|Translation completed/')).toBeVisible({
      timeout: 120000
    });
    
    const translationTime = Date.now() - startTime;
    
    // スライド数を取得
    const slideCount = await page.locator('[data-testid="slide-text"]').count();
    const timePerSlide = translationTime / slideCount;
    
    // 1スライドあたり平均10秒以内
    expect(timePerSlide).toBeLessThan(10000);
    
    console.log(`Translation Performance:`, {
      totalSlides: slideCount,
      totalTime: translationTime,
      averageTimePerSlide: timePerSlide
    });
  });

  test('並行処理のパフォーマンス', async ({ browser, baseURL }) => {
    // 3つの並行セッションを作成
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(
      contexts.map(context => context.newPage())
    );
    
    // 全てのセッションでログイン
    await Promise.all(
      pages.map(async page => {
        const loginPage = new LoginPage(page);
        await loginPage.navigate();
        await loginPage.loginAsStandardUser();
        await loginPage.expectLoginSuccess();
      })
    );
    
    const testFilePath = 'e2e/fixtures/test-presentation.pptx';
    
    // 並行アップロードの時間を測定
    const startTime = Date.now();
    
    await Promise.all(
      pages.map(async page => {
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
      })
    );
    
    const concurrentUploadTime = Date.now() - startTime;
    
    // 3つの並行アップロードが30秒以内に完了
    expect(concurrentUploadTime).toBeLessThan(30000);
    
    console.log(`Concurrent Upload Time (3 sessions): ${concurrentUploadTime}ms`);
    
    // クリーンアップ
    await Promise.all(contexts.map(context => context.close()));
  });

  test('メモリ使用量の監視', async ({ page, baseURL }) => {
    // メモリ使用量を測定する関数
    const getMemoryUsage = async () => {
      return await page.evaluate(() => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            usedJSHeapSize: memory.usedJSHeapSize,
            totalJSHeapSize: memory.totalJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit
          };
        }
        return null;
      });
    };
    
    const testFilePath = 'e2e/fixtures/test-presentation.pptx';
    
    // 初期メモリ使用量
    const initialMemory = await getMemoryUsage();
    console.log('Initial Memory:', initialMemory);
    
    // 5回連続でアップロード・削除を繰り返す
    for (let i = 0; i < 5; i++) {
      // アップロード
      await page.goto(`${baseURL}/upload`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      const uploadButton = page.locator('button:has-text("アップロード")');
      await uploadButton.click();
      await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
      
      // メモリ使用量を記録
      const memoryAfterUpload = await getMemoryUsage();
      console.log(`Memory after upload ${i + 1}:`, memoryAfterUpload);
      
      // ファイルを削除
      const fileRow = page.locator('tr:has-text("test-presentation.pptx")').first();
      const deleteButton = fileRow.locator('button:has-text("削除"), button[aria-label="削除"]');
      await deleteButton.click();
      
      const confirmButton = page.locator('button:has-text("確認"), button:has-text("削除する")');
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
      }
      
      await expect(fileRow).not.toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
      
      // ガベージコレクションを強制（可能な場合）
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      await page.waitForTimeout(1000);
    }
    
    // 最終メモリ使用量
    const finalMemory = await getMemoryUsage();
    console.log('Final Memory:', finalMemory);
    
    // メモリリークのチェック（初期の2倍以上増加していないこと）
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const increaseRatio = memoryIncrease / initialMemory.usedJSHeapSize;
      
      // メモリ増加が100%未満であることを確認
      expect(increaseRatio).toBeLessThan(1);
      
      console.log(`Memory Increase: ${(increaseRatio * 100).toFixed(2)}%`);
    }
  });

  test('レスポンスタイムの測定', async ({ page, baseURL }) => {
    // APIレスポンスタイムを測定
    const apiTimings: { [key: string]: number[] } = {
      upload: [],
      translate: [],
      extract: []
    };
    
    // レスポンスタイムを記録
    page.on('response', response => {
      const url = response.url();
      const timing = response.timing();
      
      if (url.includes('/api/upload')) {
        apiTimings.upload.push(timing.responseEnd);
      } else if (url.includes('/api/translate')) {
        apiTimings.translate.push(timing.responseEnd);
      } else if (url.includes('/api/extract')) {
        apiTimings.extract.push(timing.responseEnd);
      }
    });
    
    const testFilePath = 'e2e/fixtures/test-presentation.pptx';
    
    // アップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動
    const previewButton = page.locator('a[href*="/preview/"]').first();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    
    // 翻訳実行
    const languageSelect = page.locator('select').first();
    await languageSelect.selectOption('en');
    
    const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
    await translateButton.click();
    
    await expect(page.locator('[data-testid="translated-text"]').first()).toBeVisible({
      timeout: TEST_CONFIG.timeouts.upload
    });
    
    // レスポンスタイムの分析
    const calculateStats = (timings: number[]) => {
      if (timings.length === 0) return null;
      
      const sorted = timings.sort((a, b) => a - b);
      const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      return { avg, p50, p95, p99 };
    };
    
    console.log('API Response Times:');
    Object.entries(apiTimings).forEach(([api, timings]) => {
      const stats = calculateStats(timings);
      if (stats) {
        console.log(`  ${api}:`, {
          average: `${stats.avg.toFixed(2)}ms`,
          p50: `${stats.p50.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          p99: `${stats.p99.toFixed(2)}ms`
        });
        
        // P95が許容範囲内であることを確認
        if (api === 'upload') {
          expect(stats.p95).toBeLessThan(5000); // アップロードは5秒以内
        } else if (api === 'translate') {
          expect(stats.p95).toBeLessThan(10000); // 翻訳は10秒以内
        } else if (api === 'extract') {
          expect(stats.p95).toBeLessThan(3000); // 抽出は3秒以内
        }
      }
    });
  });

  test('キャッシュ効果の検証', async ({ page, baseURL }) => {
    const testFilePath = 'e2e/fixtures/test-presentation.pptx';
    
    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await uploadButton.click();
    await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    
    // プレビューページへ移動（1回目）
    const previewButton = page.locator('a[href*="/preview/"]').first();
    const previewUrl = await previewButton.getAttribute('href');
    
    const firstLoadStart = Date.now();
    await previewButton.click();
    await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    const firstLoadTime = Date.now() - firstLoadStart;
    
    // ダッシュボードに戻る
    await page.goto(`${baseURL}/dashboard`);
    
    // 同じプレビューページへ再度アクセス（2回目 - キャッシュ利用）
    const secondLoadStart = Date.now();
    await page.goto(`${baseURL}${previewUrl}`);
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
    const secondLoadTime = Date.now() - secondLoadStart;
    
    // 2回目のロードが1回目より速いことを確認（キャッシュ効果）
    expect(secondLoadTime).toBeLessThan(firstLoadTime);
    
    // 2回目は1回目の70%以下の時間で完了
    expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.7);
    
    console.log('Cache Performance:', {
      firstLoad: `${firstLoadTime}ms`,
      secondLoad: `${secondLoadTime}ms`,
      improvement: `${((1 - secondLoadTime / firstLoadTime) * 100).toFixed(2)}%`
    });
  });
});
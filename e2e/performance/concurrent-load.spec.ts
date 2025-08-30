import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { LoginPage, DashboardPage, UploadPage } from '../page-objects';
import * as path from 'path';

/**
 * 同時アクセス負荷テスト
 * 
 * 複数ユーザーの同時アクセスによるシステムの負荷耐性を検証
 */
test.describe('🔥 同時アクセス負荷テスト', () => {
  // 同時アクセスユーザー数の設定
  const CONCURRENT_USERS = [
    { count: 5, label: '5 users', maxResponseTime: 3000 },
    { count: 10, label: '10 users', maxResponseTime: 5000 },
    { count: 20, label: '20 users', maxResponseTime: 10000 }
  ];
  
  // テスト結果を記録
  const loadTestResults: Array<{
    userCount: number;
    successRate: number;
    avgResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    errors: number;
  }> = [];

  // タイムアウトを延長
  test.setTimeout(300000); // 5分

  /**
   * 仮想ユーザーの作成
   */
  async function createVirtualUser(
    browser: Browser,
    userId: number,
    scenario: 'login' | 'upload' | 'browse'
  ): Promise<{
    context: BrowserContext;
    page: Page;
    startTime: number;
    endTime?: number;
    success: boolean;
    error?: string;
  }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const startTime = performance.now();
    
    try {
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);
      const uploadPage = new UploadPage(page);
      
      // ログイン
      await loginPage.goto();
      await loginPage.login(`user${userId}@test.com`, 'User123456!');
      
      // シナリオの実行
      switch (scenario) {
        case 'upload':
          await uploadPage.goto();
          const testFile = path.join(process.cwd(), 'e2e', 'test-files', 'test-small.pptx');
          await uploadPage.selectFile(testFile);
          await uploadPage.clickUploadButton();
          await uploadPage.waitForUploadComplete(30000);
          break;
          
        case 'browse':
          await dashboardPage.goto();
          await dashboardPage.navigateToFiles();
          await page.waitForTimeout(1000);
          await dashboardPage.navigateToProfile();
          break;
          
        case 'login':
        default:
          // ログインのみ
          await dashboardPage.waitForDashboardToLoad();
          break;
      }
      
      const endTime = performance.now();
      
      return {
        context,
        page,
        startTime,
        endTime,
        success: true
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        context,
        page,
        startTime,
        endTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  for (const { count, label, maxResponseTime } of CONCURRENT_USERS) {
    test(`${label} - 同時ログイン負荷テスト`, async ({ browser }) => {
      console.log(`\n🚀 Starting load test with ${count} concurrent users...`);
      
      const users: Array<ReturnType<typeof createVirtualUser>> = [];
      const startTime = performance.now();
      
      // 同時にユーザーを作成してログイン
      const userPromises = [];
      for (let i = 1; i <= count; i++) {
        userPromises.push(createVirtualUser(browser, i, 'login'));
      }
      
      // すべてのユーザーの処理を待つ
      const results = await Promise.all(userPromises);
      const endTime = performance.now();
      
      // 結果の集計
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      const responseTimes = results
        .filter(r => r.endTime)
        .map(r => r.endTime! - r.startTime);
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponse = Math.max(...responseTimes);
      const minResponse = Math.min(...responseTimes);
      const successRate = (successCount / count) * 100;
      
      // 結果を記録
      loadTestResults.push({
        userCount: count,
        successRate,
        avgResponseTime,
        maxResponseTime: maxResponse,
        minResponseTime: minResponse,
        errors: failureCount
      });
      
      // アサーション
      expect(successRate).toBeGreaterThanOrEqual(90); // 90%以上の成功率
      expect(avgResponseTime).toBeLessThan(maxResponseTime);
      
      // 結果の出力
      console.log(`
        ===================================
        Load Test Results: ${label}
        ===================================
        Total Time: ${((endTime - startTime) / 1000).toFixed(2)}s
        Success Rate: ${successRate.toFixed(1)}%
        Successful: ${successCount}/${count}
        Failed: ${failureCount}/${count}
        Avg Response Time: ${avgResponseTime.toFixed(0)}ms
        Max Response Time: ${maxResponse.toFixed(0)}ms
        Min Response Time: ${minResponse.toFixed(0)}ms
        ===================================
      `);
      
      // エラーの詳細を出力
      if (failureCount > 0) {
        console.log('Errors:');
        results.filter(r => !r.success).forEach((r, i) => {
          console.log(`  User ${i + 1}: ${r.error}`);
        });
      }
      
      // クリーンアップ
      for (const result of results) {
        await result.context.close();
      }
    });

    test(`${label} - 同時アップロード負荷テスト`, async ({ browser }) => {
      console.log(`\n📤 Starting upload load test with ${count} concurrent users...`);
      
      const startTime = performance.now();
      
      // 同時にアップロードを実行
      const userPromises = [];
      for (let i = 1; i <= count; i++) {
        userPromises.push(createVirtualUser(browser, i, 'upload'));
      }
      
      const results = await Promise.all(userPromises);
      const endTime = performance.now();
      
      // 結果の集計
      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / count) * 100;
      
      // アサーション
      expect(successRate).toBeGreaterThanOrEqual(80); // アップロードは80%以上の成功率
      
      console.log(`
        Upload Load Test: ${label}
        Success Rate: ${successRate.toFixed(1)}%
        Total Time: ${((endTime - startTime) / 1000).toFixed(2)}s
      `);
      
      // クリーンアップ
      for (const result of results) {
        await result.context.close();
      }
    });
  }

  test('スパイクテスト - 急激な負荷増加', async ({ browser }) => {
    console.log('\n⚡ Starting spike test...');
    
    const waves = [
      { users: 5, delay: 0 },
      { users: 10, delay: 5000 },
      { users: 20, delay: 5000 },
      { users: 5, delay: 5000 }
    ];
    
    for (const { users, delay } of waves) {
      if (delay > 0) {
        console.log(`Waiting ${delay}ms before next wave...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`Sending wave of ${users} users...`);
      
      const userPromises = [];
      for (let i = 1; i <= users; i++) {
        userPromises.push(createVirtualUser(browser, i, 'browse'));
      }
      
      const results = await Promise.all(userPromises);
      const successRate = (results.filter(r => r.success).length / users) * 100;
      
      console.log(`Wave complete: ${successRate.toFixed(1)}% success rate`);
      
      // クリーンアップ
      for (const result of results) {
        await result.context.close();
      }
    }
  });

  test('持続負荷テスト - 長時間の負荷', async ({ browser }) => {
    console.log('\n⏱️ Starting sustained load test...');
    
    const DURATION = 60000; // 1分間
    const USERS_PER_BATCH = 5;
    const BATCH_INTERVAL = 10000; // 10秒ごと
    
    const startTime = performance.now();
    const allResults = [];
    
    while (performance.now() - startTime < DURATION) {
      console.log(`Batch at ${((performance.now() - startTime) / 1000).toFixed(1)}s`);
      
      const userPromises = [];
      for (let i = 1; i <= USERS_PER_BATCH; i++) {
        userPromises.push(createVirtualUser(browser, i, 'browse'));
      }
      
      const results = await Promise.all(userPromises);
      allResults.push(...results);
      
      // クリーンアップ
      for (const result of results) {
        await result.context.close();
      }
      
      await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL));
    }
    
    const totalUsers = allResults.length;
    const successCount = allResults.filter(r => r.success).length;
    const successRate = (successCount / totalUsers) * 100;
    
    console.log(`
      Sustained Load Test Complete:
      Duration: ${DURATION / 1000}s
      Total Users: ${totalUsers}
      Success Rate: ${successRate.toFixed(1)}%
    `);
    
    expect(successRate).toBeGreaterThanOrEqual(90);
  });

  test.afterAll(async () => {
    // 負荷テストレポートの生成
    console.log('\n📊 Load Test Summary Report:');
    console.log('=====================================');
    console.table(loadTestResults);
    
    // グラフ用のデータ生成
    const chartData = {
      labels: loadTestResults.map(r => `${r.userCount} users`),
      datasets: [
        {
          label: 'Success Rate (%)',
          data: loadTestResults.map(r => r.successRate)
        },
        {
          label: 'Avg Response Time (ms)',
          data: loadTestResults.map(r => r.avgResponseTime)
        }
      ]
    };
    
    console.log('\n📈 Chart Data (for visualization):');
    console.log(JSON.stringify(chartData, null, 2));
    
    // パフォーマンス基準の確認
    const allSuccessRates = loadTestResults.map(r => r.successRate);
    const overallSuccessRate = allSuccessRates.reduce((a, b) => a + b, 0) / allSuccessRates.length;
    
    console.log(`\n✅ Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
    
    if (overallSuccessRate < 90) {
      console.warn('⚠️ Warning: Overall success rate is below 90%');
    }
  });
});
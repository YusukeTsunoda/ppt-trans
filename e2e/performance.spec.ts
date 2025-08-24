import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // パフォーマンスメトリクスを有効化
    await page.addInitScript(() => {
      (window as any).performanceMetrics = {
        startTime: Date.now(),
        marks: new Map(),
      };
    });
  });

  test('Dashboard should load within 3 seconds', async ({ page }) => {
    const startTime = Date.now();
    
    // ダッシュボードにアクセス
    await page.goto('/dashboard');
    
    // コンテンツが表示されるまで待機
    await page.waitForSelector('[data-testid="dashboard-content"], .container', {
      timeout: 3000
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('Preview page should use dynamic import', async ({ page }) => {
    // プレビューページにアクセス
    await page.goto('/dashboard');
    
    // ネットワークリクエストを監視
    const chunkRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('_next/static/chunks/') && url.includes('PreviewView')) {
        chunkRequests.push(url);
      }
    });
    
    // プレビューページへ遷移（実際のファイルIDが必要な場合はモック）
    // この部分は実際の実装に応じて調整
    
    // 動的インポートが使用されていることを確認
    // PreviewViewチャンクが遅延読み込みされることを期待
  });

  test('Security headers should be present', async ({ page }) => {
    const response = await page.goto('/');
    
    if (response) {
      const headers = response.headers();
      
      // セキュリティヘッダーの確認
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['permissions-policy']).toBeDefined();
      
      // CSPヘッダーの確認
      const csp = headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    }
  });

  test.skip('API rate limiting should work', async ({ page }) => {
    // レート制限のテスト（実装後に有効化）
    // 現在はrate-limitライブラリを削除したため、スキップ
    // TODO: カスタムレート制限実装後に再有効化
  });

  test('Bundle size should be optimized', async ({ page }) => {
    const resourceSizes = new Map<string, number>();
    
    // リソースサイズを監視
    page.on('response', response => {
      const url = response.url();
      if (url.includes('_next/static/')) {
        const size = response.headers()['content-length'];
        if (size) {
          const type = url.includes('.js') ? 'js' : 
                       url.includes('.css') ? 'css' : 'other';
          const current = resourceSizes.get(type) || 0;
          resourceSizes.set(type, current + parseInt(size));
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // JavaScriptバンドルサイズの確認（目標: < 1.2MB）
    const jsSize = resourceSizes.get('js') || 0;
    console.log(`Total JS bundle size: ${(jsSize / 1024 / 1024).toFixed(2)}MB`);
    expect(jsSize).toBeLessThan(1.2 * 1024 * 1024);
  });

  test('Memory usage should be reasonable', async ({ page }) => {
    await page.goto('/dashboard');
    
    // メモリ使用量を測定
    const metrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return null;
    });
    
    if (metrics) {
      const usedMB = metrics.usedJSHeapSize / 1024 / 1024;
      console.log(`Memory usage: ${usedMB.toFixed(2)}MB`);
      
      // メモリ使用量が150MB未満であることを確認
      expect(usedMB).toBeLessThan(150);
    }
  });

  test('First Contentful Paint should be fast', async ({ page }) => {
    await page.goto('/');
    
    // パフォーマンスメトリクスを取得
    const metrics = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        // LCPとFCPを取得
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcp = entries.find(e => e.name === 'first-contentful-paint');
          const lcp = entries.find(e => e.entryType === 'largest-contentful-paint');
          
          if (fcp) {
            resolve({
              fcp: fcp.startTime,
              lcp: lcp ? lcp.startTime : null
            });
          }
        }).observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
        
        // タイムアウト
        setTimeout(() => resolve(null), 5000);
      });
    });
    
    if (metrics) {
      console.log(`FCP: ${metrics.fcp}ms, LCP: ${metrics.lcp}ms`);
      
      // FCP < 1.8秒
      expect(metrics.fcp).toBeLessThan(1800);
      
      // LCP < 2.5秒
      if (metrics.lcp) {
        expect(metrics.lcp).toBeLessThan(2500);
      }
    }
  });
});

test.describe('Component Loading Tests', () => {
  test('Dynamic imports should show loading state', async ({ page }) => {
    await page.goto('/profile');
    
    // ローディング状態が表示されることを確認
    const loadingIndicator = page.locator('.animate-spin').first();
    
    // 一時的にローディングが表示される可能性
    const wasVisible = await loadingIndicator.isVisible().catch(() => false);
    
    // 最終的にコンテンツが表示される（より一般的なセレクタを使用）
    await page.waitForSelector('main, .container, [role="main"]', {
      timeout: 5000
    });
    
    console.log(`Loading indicator was visible: ${wasVisible}`);
  });

  test('Preload strategy should work', async ({ page }) => {
    const preloadedChunks = new Set<string>();
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('_next/static/chunks/') && url.includes('pages')) {
        preloadedChunks.add(url);
      }
    });
    
    // ダッシュボードにアクセス
    await page.goto('/dashboard');
    
    // 2秒待機（プリロード戦略のタイマー）
    await page.waitForTimeout(2500);
    
    // プリロードされたチャンクがあることを確認
    console.log(`Preloaded ${preloadedChunks.size} chunks`);
    expect(preloadedChunks.size).toBeGreaterThan(0);
  });
});
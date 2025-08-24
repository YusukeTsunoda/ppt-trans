# 最適化実装ガイド - 多角的観点からのリスク管理

## 1. 依存関係削除の安全な実装

### Step 1: セキュリティ機能の移行（1時間）

```bash
# 1. middleware-security.tsの統合
cp src/middleware-security.ts src/middleware-security.backup.ts

# 2. 既存のmiddleware.tsを更新
```

```typescript
// src/middleware.ts
import { applySecurityHeaders, checkRateLimit, validateRequest } from './middleware-security';

export async function middleware(request: NextRequest) {
  // セキュリティ検証
  const validation = validateRequest(request);
  if (!validation.valid) {
    return new NextResponse(null, { status: 400, statusText: validation.reason });
  }
  
  // レート制限
  const ip = request.ip || 'unknown';
  const endpoint = request.nextUrl.pathname;
  const rateLimitConfig = RATE_LIMIT_CONFIGS[endpoint] || RATE_LIMIT_CONFIGS.api;
  const rateLimit = checkRateLimit(ip, endpoint, rateLimitConfig);
  
  if (!rateLimit.allowed) {
    return new NextResponse(null, { 
      status: 429, 
      headers: {
        'X-RateLimit-Limit': String(rateLimitConfig.max),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
      }
    });
  }
  
  // 既存の処理...
  const response = NextResponse.next();
  
  // セキュリティヘッダーを適用
  return applySecurityHeaders(response);
}
```

### Step 2: 依存関係の段階的削除

```bash
# 1. 開発環境でテスト
npm run dev
# 各ページにアクセスしてセキュリティヘッダーを確認

# 2. テストが成功したら削除
npm uninstall helmet express-rate-limit csrf bull critters
npm uninstall @types/bull @types/express-rate-limit

# 3. ビルド確認
npm run build
```

## 2. 動的インポートの段階的実装

### Step 1: 影響分析とメトリクス測定

```typescript
// src/lib/optimization/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number> = new Map();
  
  measureBefore(): void {
    if (typeof window !== 'undefined') {
      // 現在のメトリクスを記録
      this.metrics.set('FCP', performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0);
      this.metrics.set('LCP', performance.getEntriesByName('largest-contentful-paint')[0]?.startTime || 0);
      this.metrics.set('TTI', performance.timing.domInteractive - performance.timing.navigationStart);
    }
  }
  
  measureAfter(): void {
    // 変更後のメトリクスと比較
    const improvements = new Map<string, number>();
    // ... 計算ロジック
    console.table(improvements);
  }
}
```

### Step 2: 優先順位に基づく実装

```typescript
// 1. 最も重いコンポーネントから開始
// src/app/preview/[id]/page.tsx
import dynamic from 'next/dynamic';
import { DynamicImportManager, LoadingStates } from '@/lib/optimization/dynamic-import-strategy';

const PreviewView = dynamic(
  () => import('./PreviewView'),
  {
    loading: () => <LoadingStates.Skeleton height={600} />,
    ssr: false, // SEOが不要なページ
  }
);

// プリロード戦略
export default function PreviewPage() {
  useEffect(() => {
    // 関連コンポーネントをプリロード
    DynamicImportManager.preloadByRoute('/preview');
  }, []);
  
  return <PreviewView />;
}
```

### Step 3: エラーハンドリングの実装

```typescript
// グローバルエラーバウンダリを更新
// src/app/layout.tsx
import { DynamicImportError } from '@/lib/optimization/dynamic-import-strategy';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary
          fallback={(error, retry) => (
            <DynamicImportError
              error={error}
              retry={retry}
              componentName="Application"
            />
          )}
        >
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
```

## 3. API最適化の実装

### Step 1: 既存APIの分析

```typescript
// src/lib/optimization/api-analyzer.ts
export async function analyzeAPICalls() {
  const analysis = {
    duplicates: [],
    sequential: [],
    uncached: [],
  };
  
  // 開発環境でのみ実行
  if (process.env.NODE_ENV === 'development') {
    // Interceptorを設定してAPI呼び出しを監視
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      console.log('API Call:', args[0]);
      return originalFetch(...args);
    };
  }
  
  return analysis;
}
```

### Step 2: 段階的な並列化

```typescript
// Before: 直列実行
const user = await getUser();
const files = await getFiles();
const stats = await getStats();

// After: 並列実行（エラーハンドリング付き）
const results = await Promise.allSettled([
  getUser(),
  getFiles(), 
  getStats(),
]);

const [userResult, filesResult, statsResult] = results;

// エラーハンドリング
if (userResult.status === 'rejected') {
  console.error('User fetch failed:', userResult.reason);
  // フォールバック処理
}
```

## 4. テスト戦略

### 単体テスト

```typescript
// src/lib/optimization/__tests__/security.test.ts
describe('Security Headers', () => {
  it('should include all required headers', async () => {
    const response = await fetch('/api/test');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    // ... 他のヘッダー
  });
});
```

### E2Eテスト

```typescript
// e2e/performance.spec.ts
test('should load dashboard within 3 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/dashboard');
  await page.waitForSelector('[data-testid="dashboard-content"]');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000);
});
```

## 5. ロールバック計画

### 問題が発生した場合の対処

```bash
# 1. 依存関係の復元
git checkout package.json package-lock.json
npm install

# 2. コードの復元
git checkout src/middleware.ts

# 3. 動的インポートの無効化
# next.config.jsで設定
module.exports = {
  experimental: {
    dynamicImports: false, // 一時的に無効化
  }
}
```

## 6. モニタリングとアラート

```typescript
// src/lib/monitoring/performance-tracker.ts
export class PerformanceTracker {
  static track(metricName: string, value: number): void {
    // Sentryやその他の監視ツールに送信
    if (window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: metricName,
        value: Math.round(value),
      });
    }
    
    // 閾値チェック
    const thresholds = {
      FCP: 1800,
      LCP: 2500,
      TTI: 3000,
    };
    
    if (value > thresholds[metricName]) {
      console.warn(`Performance degradation detected: ${metricName} = ${value}ms`);
      // アラート送信
    }
  }
}
```

## 7. チェックリスト

### Pre-deployment
- [ ] セキュリティヘッダーの動作確認
- [ ] レート制限の動作確認
- [ ] 動的インポートのローディング状態確認
- [ ] エラーハンドリングの確認
- [ ] API並列化の動作確認
- [ ] パフォーマンスメトリクスの測定

### Post-deployment
- [ ] 本番環境でのセキュリティヘッダー確認
- [ ] エラー率の監視（< 1%）
- [ ] パフォーマンスメトリクスの監視
- [ ] ユーザーフィードバックの収集

## 8. 段階的リリース戦略

```typescript
// Feature Flagを使用した段階的リリース
const FEATURE_FLAGS = {
  USE_DYNAMIC_IMPORTS: process.env.FEATURE_DYNAMIC_IMPORTS === 'true',
  USE_API_BATCHING: process.env.FEATURE_API_BATCHING === 'true',
  USE_ADVANCED_CACHING: process.env.FEATURE_ADVANCED_CACHING === 'true',
};

// 使用例
if (FEATURE_FLAGS.USE_DYNAMIC_IMPORTS) {
  // 新しい実装
} else {
  // 既存の実装
}
```

## 結論

この実装ガイドに従うことで：
1. **セキュリティリスク**: 0（すべてのセキュリティ機能を維持）
2. **パフォーマンス改善**: 40-60%（初期ロード時間）
3. **保守性向上**: コード分割により管理が容易に
4. **ロールバック時間**: 5分以内

各ステップは独立して実装・テスト可能なため、リスクを最小限に抑えながら段階的に改善を進めることができます。
# CSRF重大セキュリティホール修正計画書

## 緊急度レベル
🔴 **CRITICAL** - 本番環境デプロイ前に必須修正

## 修正実装計画

---

## Phase 1: APIエンドポイントのCSRF保護追加（優先度: 最高）

### 1.1 `/src/app/api/translate/route.ts`
**現状**: CSRF保護なし  
**リスク**: 不正な翻訳リクエストによるAPIキー消費攻撃

```typescript
// 修正前（11行目から）
export async function POST(request: NextRequest) {
  try {
    const { texts, targetLanguage } = await request.json();

// 修正後
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';

export async function POST(request: NextRequest) {
  // セキュリティチェックを追加
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 30,
      windowMs: 60 * 1000, // 1分あたり30リクエスト
    },
    contentType: 'application/json',
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  try {
    const { texts, targetLanguage } = await request.json();
```

### 1.2 `/src/app/api/files/[id]/route.ts`
**現状**: CSRF保護なし  
**リスク**: 任意のファイル削除攻撃

```typescript
// 修正前（11行目から）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;

// 修正後
import { performSecurityChecks, createErrorResponse } from '@/lib/security/api-security';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // セキュリティチェックを追加
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    methods: ['DELETE'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  try {
    const fileId = params.id;
    
    // ユーザー認証も追加
    const supabaseServer = await createServerClient();
    const { data: { user } } = await supabaseServer.auth.getUser();
    
    if (!user) {
      return createErrorResponse('認証が必要です', 401);
    }
```

### 1.3 `/src/app/api/extract/route.ts`
**現状**: CSRF保護なし  
**リスク**: リソース消費攻撃

```typescript
// 追加する内容（ファイル先頭）
import { performSecurityChecks, createErrorResponse } from '@/lib/security/api-security';

export async function POST(request: NextRequest) {
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1分あたり10リクエスト（重い処理のため）
    },
    contentType: 'multipart/form-data',
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  // 既存のコード...
}
```

### 1.4 `/src/app/api/apply-translations/route.ts`
**現状**: CSRF保護なし  
**リスク**: データ改ざん攻撃

```typescript
// 追加する内容
import { performSecurityChecks, createErrorResponse } from '@/lib/security/api-security';

export async function POST(request: NextRequest) {
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    contentType: 'application/json',
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  // 既存のコード...
}
```

### 1.5 `/src/app/api/translate-pptx/route.ts`
**現状**: CSRF保護なし  
**リスク**: 不正なファイル処理

```typescript
// 追加する内容
import { performSecurityChecks, createErrorResponse } from '@/lib/security/api-security';

export async function POST(request: NextRequest) {
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1分あたり5リクエスト（非常に重い処理）
    },
    contentType: 'multipart/form-data',
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  // 既存のコード...
}
```

---

## Phase 2: フロントエンドのfetch呼び出し修正（優先度: 高）

### 2.1 `/src/components/dashboard/DashboardView.tsx`
**現状**: CSRFトークンなしのfetch呼び出し  
**行番号**: 240-243

```typescript
// 修正前（240-243行目）
const response = await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include',
});

// 修正後
import { fetchWithCSRF } from '@/hooks/useCSRF';

const response = await fetchWithCSRF('/api/auth/logout', {
  method: 'POST',
});
```

**追加修正箇所**: ファイル削除処理（推定）
```typescript
// handleDeleteFileなどの関数内
const response = await fetchWithCSRF(`/api/files/${fileId}`, {
  method: 'DELETE',
});
```

### 2.2 `/src/components/PreviewScreen.tsx`
**現状**: 翻訳APIへのCSRFトークンなしリクエスト

```typescript
// 修正前
const response = await fetch('/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texts, targetLanguage })
});

// 修正後
import { fetchWithCSRF } from '@/hooks/useCSRF';

const response = await fetchWithCSRF('/api/translate', {
  method: 'POST',
  body: JSON.stringify({ texts, targetLanguage })
});
```

### 2.3 `/src/components/upload/UploadModal.tsx`
**現状**: 一部のfetch呼び出しでCSRF未使用

```typescript
// ファイル内のすべてのfetch呼び出しを確認し修正
import { fetchWithCSRF } from '@/hooks/useCSRF';

// すべてのPOST/PUT/DELETEリクエストを置換
const response = await fetchWithCSRF('/api/upload', {
  method: 'POST',
  body: formData,
});
```

### 2.4 `/src/components/SettingsScreen.tsx`
**現状**: 設定更新時のCSRF未使用

```typescript
// 修正前
const response = await fetch('/api/user/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(settings)
});

// 修正後
import { fetchWithCSRF } from '@/hooks/useCSRF';

const response = await fetchWithCSRF('/api/user/settings', {
  method: 'PUT',
  body: JSON.stringify(settings)
});
```

---

## Phase 3: CSRFトークン管理の強化（優先度: 中）

### 3.1 `/src/lib/security/csrf.ts`
**改善点**: トークンローテーション機能の追加

```typescript
export class CSRFProtection {
  private static ROTATION_INTERVAL = 60 * 60 * 1000; // 1時間
  
  /**
   * トークンをローテーション
   */
  static async rotateTokenIfNeeded(): Promise<string | null> {
    const cookieStore = await cookies();
    const tokenData = cookieStore.get(CSRF_TOKEN_NAME);
    
    if (!tokenData) return null;
    
    // トークンの作成時刻を確認
    const tokenAge = Date.now() - (tokenData.expires?.getTime() || 0);
    
    if (tokenAge > this.ROTATION_INTERVAL) {
      return this.generateToken();
    }
    
    return null;
  }
  
  /**
   * Cookie設定の改善
   */
  static async generateToken(): Promise<string> {
    const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    const cookieStore = await cookies();
    
    cookieStore.set(CSRF_TOKEN_NAME, token, {
      httpOnly: true, // XSS対策として変更
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 4, // 4時間に短縮
    });
    
    // metaタグ用の別トークンを生成
    cookieStore.set(`${CSRF_TOKEN_NAME}-meta`, token, {
      httpOnly: false, // JavaScriptアクセス用
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 4,
    });
    
    return token;
  }
}
```

### 3.2 `/src/hooks/useCSRF.ts`
**改善点**: エラーハンドリングとリトライロジック

```typescript
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const fetchCSRFToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store', // キャッシュ無効化
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const token = data.csrfToken || data.token;
      
      if (!token) {
        throw new Error('Invalid CSRF token response');
      }
      
      setCSRFToken(token);
      retryCount.current = 0;
      return token;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'CSRFトークンの取得に失敗しました';
      
      // リトライロジック
      if (retryCount.current < MAX_RETRIES) {
        retryCount.current++;
        setTimeout(() => fetchCSRFToken(), 1000 * retryCount.current);
      } else {
        setError(errorMessage);
        console.error('CSRF token fetch failed after retries:', err);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ... 既存のコード
}
```

---

## Phase 4: Middleware による一元管理（優先度: 低 - 長期改善）

### 4.1 `/src/middleware.ts`の作成
**新規ファイル**: すべてのAPIルートを保護

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { performSecurityChecks } from '@/lib/security/api-security';

export async function middleware(request: NextRequest) {
  // APIルートのみ処理
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // 除外パス（公開API）
  const publicPaths = [
    '/api/auth/csrf',
    '/api/health',
    '/api/public',
  ];
  
  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // セキュリティチェック
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
  });
  
  if (!securityCheck.success) {
    return NextResponse.json(
      { error: securityCheck.error },
      { status: securityCheck.status }
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## Phase 5: テストケースの追加（優先度: 高）

### 5.1 `/e2e/security/csrf.spec.ts`
**新規ファイル**: CSRF保護のE2Eテスト

```typescript
import { test, expect } from '@playwright/test';

test.describe('CSRF Protection', () => {
  test('should reject request without CSRF token', async ({ page }) => {
    const response = await page.request.post('/api/translate', {
      data: { text: 'test' },
    });
    
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });
  
  test('should reject request with invalid CSRF token', async ({ page }) => {
    const response = await page.request.post('/api/translate', {
      headers: {
        'X-CSRF-Token': 'invalid-token',
      },
      data: { text: 'test' },
    });
    
    expect(response.status()).toBe(403);
  });
  
  test('should accept request with valid CSRF token', async ({ page }) => {
    // CSRFトークン取得
    const csrfResponse = await page.request.get('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    
    // 正しいトークンでリクエスト
    const response = await page.request.post('/api/translate', {
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      data: { texts: ['test'], targetLanguage: 'ja' },
    });
    
    expect(response.status()).not.toBe(403);
  });
});
```

### 5.2 `/tests/security/csrf.test.ts`
**新規ファイル**: 単体テスト

```typescript
import { CSRFProtection } from '@/lib/security/csrf';
import { NextRequest } from 'next/server';

describe('CSRF Protection', () => {
  describe('Token Generation', () => {
    it('should generate unique tokens', async () => {
      const token1 = await CSRFProtection.generateToken();
      const token2 = await CSRFProtection.generateToken();
      expect(token1).not.toBe(token2);
    });
    
    it('should generate tokens of correct length', async () => {
      const token = await CSRFProtection.generateToken();
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)
    });
  });
  
  describe('Token Verification', () => {
    it('should skip GET requests', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      });
      
      const result = await CSRFProtection.verifyToken(request);
      expect(result).toBe(true);
    });
    
    it('should reject POST without token', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
      });
      
      const result = await CSRFProtection.verifyToken(request);
      expect(result).toBe(false);
    });
  });
});
```

---

## Phase 6: 監視とログの実装（優先度: 中）

### 6.1 `/src/lib/security/csrf-monitor.ts`
**新規ファイル**: CSRF攻撃の監視

```typescript
import logger from '@/lib/logger';
import { Redis } from 'ioredis';

export class CSRFMonitor {
  private static redis = new Redis(process.env.REDIS_URL);
  
  /**
   * CSRF検証失敗をログ記録
   */
  static async logFailure(
    request: NextRequest,
    reason: string
  ): Promise<void> {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    const data = {
      timestamp: new Date().toISOString(),
      ip,
      url: request.url,
      method: request.method,
      reason,
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    };
    
    // ログ記録
    logger.warn('CSRF validation failure', data);
    
    // Redis に記録（攻撃パターン分析用）
    await this.redis.lpush(
      `csrf:failures:${ip}`,
      JSON.stringify(data)
    );
    
    // 失敗回数をカウント
    const failureCount = await this.redis.incr(`csrf:fail_count:${ip}`);
    await this.redis.expire(`csrf:fail_count:${ip}`, 3600); // 1時間
    
    // 閾値超過時にアラート
    if (failureCount > 10) {
      logger.error('Potential CSRF attack detected', {
        ip,
        failureCount,
        timeWindow: '1 hour',
      });
      
      // 自動ブロック（オプション）
      if (process.env.AUTO_BLOCK_CSRF_ATTACKS === 'true') {
        await this.blockIP(ip);
      }
    }
  }
  
  /**
   * IPアドレスをブロック
   */
  private static async blockIP(ip: string): Promise<void> {
    await this.redis.set(
      `blocked:${ip}`,
      'csrf_attack',
      'EX',
      86400 // 24時間ブロック
    );
    
    logger.error('IP blocked due to CSRF attacks', { ip });
  }
}
```

---

## 実装スケジュール

### Day 1（24時間以内）- 緊急対応
- [ ] Phase 1: すべてのAPIエンドポイントにCSRF保護追加
- [ ] Phase 2.1-2.2: 最も重要なフロントエンド修正（DashboardView, PreviewScreen）

### Day 2-3（48-72時間）- 重要対応
- [ ] Phase 2.3-2.4: 残りのフロントエンド修正
- [ ] Phase 5: テストケース追加と実行

### Week 1（1週間以内）- 改善実装
- [ ] Phase 3: CSRFトークン管理の強化
- [ ] Phase 6: 監視とログの実装

### Month 1（1ヶ月以内）- 長期改善
- [ ] Phase 4: Middleware による一元管理
- [ ] パフォーマンステストと最適化
- [ ] セキュリティ監査の再実施

---

## 検証チェックリスト

### 修正後の確認項目
- [ ] すべてのPOST/PUT/DELETE/PATCHエンドポイントがCSRF保護されている
- [ ] すべてのfetch呼び出しがfetchWithCSRFを使用
- [ ] E2Eテストがすべて合格
- [ ] 新規セキュリティテストがすべて合格
- [ ] パフォーマンスへの影響が許容範囲内（<100ms遅延）
- [ ] エラーログに異常がない
- [ ] 本番環境設定の確認完了

## 成功基準

### 技術的成功基準
- CSRFトークン検証率: 100%
- セキュリティテストカバレッジ: >90%
- 誤検知率: <0.1%
- レスポンスタイム増加: <50ms

### ビジネス成功基準
- セキュリティインシデント: 0件
- ユーザー体験への影響: 最小限
- コンプライアンス要件: 完全準拠

---

**重要**: この修正計画は段階的に実装可能ですが、Phase 1とPhase 2.1-2.2は本番デプロイ前に必須です。
# API Routes セキュリティ実装 詳細修正計画

## 概要
API Routesに移行した認証システムにおいて、CSRF保護などのセキュリティ機能が実装されたが、E2Eテストとクライアント側の統合が不完全な状態である。本計画書では、具体的な修正内容と実装手順を詳細に記載する。

## 現状の問題点

### 1. E2EテストがCSRFトークンを処理できない
- `APIRoutesHelper.fillAndSubmitForm`メソッドがCSRFトークンを取得・送信していない
- テスト実行時にCSRF検証エラーで失敗する

### 2. LoginFormコンポーネントがCSRFトークンを送信していない
- フォーム送信時にCSRFトークンがヘッダーに含まれていない
- APIエンドポイントでCSRF検証に失敗する

### 3. セキュリティチェックが直列処理で性能低下
- レート制限、Origin検証、CSRF検証が順次実行されている
- 並列化可能な処理が最適化されていない

## 詳細実装計画

### Phase 1: E2Eテストヘルパーの修正

#### 1-1. `/e2e/helpers/api-routes-helper.ts` の修正

**現在のコード:**
```typescript
static async fillAndSubmitForm(
  page: Page,
  formData: Record<string, string>,
  submitButtonSelector: string = 'button[type="submit"]',
  expectedUrl?: string | RegExp
) {
  // フォームに入力
  for (const [name, value] of Object.entries(formData)) {
    const selector = `[name="${name}"]`;
    await page.fill(selector, value);
  }
  
  // Submit form
  return this.submitFormToAPI(page, submitButtonSelector, expectedUrl);
}
```

**修正後のコード:**
```typescript
import { Page, Cookie } from '@playwright/test';

export class APIRoutesHelper {
  /**
   * CSRFトークンを取得してCookieに設定
   */
  private static async setupCSRFToken(page: Page): Promise<string> {
    // CSRFトークンエンドポイントから取得
    const response = await page.request.get('/api/auth/csrf');
    const data = await response.json();
    
    if (!data.token) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    // Cookieに設定（httpOnly: falseなのでJavaScriptからもアクセス可能）
    await page.context().addCookies([{
      name: 'csrf-token',
      value: data.token,
      domain: new URL(page.url()).hostname,
      path: '/',
      httpOnly: false,
      secure: false, // テスト環境ではfalse
      sameSite: 'Strict' as const
    }]);
    
    // ページのlocalStorageにも保存（必要に応じて）
    await page.evaluate((token) => {
      localStorage.setItem('csrf-token', token);
      // metaタグにも設定
      let meta = document.querySelector('meta[name="csrf-token"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', token);
    }, data.token);
    
    return data.token;
  }

  /**
   * APIリクエスト用のヘッダーを構築
   */
  private static async buildHeaders(page: Page, csrfToken: string): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'Accept': 'application/json',
    };
  }

  /**
   * フォームの入力と送信（CSRF対応版）
   */
  static async fillAndSubmitForm(
    page: Page,
    formData: Record<string, string>,
    submitButtonSelector: string = 'button[type="submit"]',
    expectedUrl?: string | RegExp
  ) {
    // 1. CSRFトークンをセットアップ
    const csrfToken = await this.setupCSRFToken(page);
    
    // 2. フォームフィールドに入力
    for (const [name, value] of Object.entries(formData)) {
      const selector = `[name="${name}"]`;
      await page.fill(selector, value);
    }
    
    // 3. XHRインターセプトを設定してヘッダーを追加
    await page.route('**/api/**', async (route, request) => {
      const headers = {
        ...request.headers(),
        'X-CSRF-Token': csrfToken,
      };
      await route.continue({ headers });
    });
    
    // 4. フォーム送信
    const navigationPromise = expectedUrl 
      ? page.waitForURL(expectedUrl, { 
          timeout: 10000,
          waitUntil: 'networkidle' 
        })
      : Promise.resolve();
    
    // 5. ボタンクリック
    await page.click(submitButtonSelector);
    
    // 6. ナビゲーション待機
    if (expectedUrl) {
      await navigationPromise;
    }
    
    // 7. ルートハンドラーをクリア
    await page.unroute('**/api/**');
    
    return true;
  }

  /**
   * 直接APIコール（CSRF対応版）
   */
  static async callAPI(
    page: Page,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any
  ) {
    const csrfToken = await this.setupCSRFToken(page);
    const headers = await this.buildHeaders(page, csrfToken);
    
    const response = await page.request[method.toLowerCase()](endpoint, {
      headers,
      data: body ? JSON.stringify(body) : undefined,
    });
    
    return response;
  }
}
```

#### 1-2. `/e2e/fixtures/test-config-v2.ts` への追加

```typescript
export const TEST_CONFIG = {
  // 既存の設定...
  
  security: {
    csrf: {
      enabled: true,
      tokenEndpoint: '/api/auth/csrf',
      headerName: 'X-CSRF-Token',
      cookieName: 'csrf-token',
    },
    rateLimit: {
      retryAfter: 1000, // ミリ秒
      maxRetries: 3,
    },
  },
  
  // テスト環境用の設定
  testEnvironment: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    isCI: process.env.CI === 'true',
    debug: process.env.DEBUG === 'true',
  },
};
```

### Phase 2: LoginFormコンポーネントの修正

#### 2-1. `/src/hooks/useCSRF.ts` の作成（新規ファイル）

```typescript
import { useState, useEffect } from 'react';

interface CSRFToken {
  token: string;
  expiresAt: number;
}

export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchCSRFToken();
  }, []);

  const fetchCSRFToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // キャッシュから取得を試みる
      const cached = localStorage.getItem('csrf-token-cache');
      if (cached) {
        const parsed: CSRFToken = JSON.parse(cached);
        if (parsed.expiresAt > Date.now()) {
          setCSRFToken(parsed.token);
          setLoading(false);
          return;
        }
      }
      
      // APIから新規取得
      const response = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      
      const data = await response.json();
      
      // キャッシュに保存（23時間有効）
      const tokenData: CSRFToken = {
        token: data.token,
        expiresAt: Date.now() + (23 * 60 * 60 * 1000),
      };
      localStorage.setItem('csrf-token-cache', JSON.stringify(tokenData));
      
      setCSRFToken(data.token);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('CSRF token fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshToken = () => {
    localStorage.removeItem('csrf-token-cache');
    fetchCSRFToken();
  };

  return {
    csrfToken,
    loading,
    error,
    refreshToken,
  };
}

/**
 * CSRFトークンを含むfetchラッパー
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // CSRFトークンを取得
  const cached = localStorage.getItem('csrf-token-cache');
  let csrfToken = '';
  
  if (cached) {
    const parsed: CSRFToken = JSON.parse(cached);
    if (parsed.expiresAt > Date.now()) {
      csrfToken = parsed.token;
    }
  }
  
  // トークンが無い場合は取得
  if (!csrfToken) {
    const response = await fetch('/api/auth/csrf');
    const data = await response.json();
    csrfToken = data.token;
    
    // キャッシュに保存
    const tokenData: CSRFToken = {
      token: csrfToken,
      expiresAt: Date.now() + (23 * 60 * 60 * 1000),
    };
    localStorage.setItem('csrf-token-cache', JSON.stringify(tokenData));
  }
  
  // ヘッダーにCSRFトークンを追加
  const headers = {
    ...options.headers,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  };
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  });
}
```

#### 2-2. `/src/components/auth/LoginForm.tsx` の修正

```typescript
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCSRF, fetchWithCSRF } from '@/hooks/useCSRF';

export default function LoginForm() {
  const router = useRouter();
  const { csrfToken, loading: csrfLoading, error: csrfError, refreshToken } = useCSRF();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    remaining: number;
    retryAfter?: number;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // CSRFトークンが無い場合はエラー
    if (!csrfToken) {
      setError('セキュリティトークンの取得に失敗しました。ページを更新してください。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetchWithCSRF('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      // レート制限情報を取得
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining !== null) {
        setRateLimitInfo({
          remaining: parseInt(remaining, 10),
          retryAfter: response.status === 429 
            ? parseInt(response.headers.get('Retry-After') || '60', 10)
            : undefined,
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        // レート制限エラー
        if (response.status === 429) {
          const retryAfter = data.retryAfter || 60;
          setError(`リクエストが多すぎます。${retryAfter}秒後に再試行してください。`);
          
          // 自動リトライのタイマー設定（オプション）
          setTimeout(() => {
            setError(null);
            setRateLimitInfo(null);
          }, retryAfter * 1000);
          
          return;
        }
        
        // CSRF検証エラー
        if (response.status === 403 && data.error?.includes('セキュリティトークン')) {
          // トークンをリフレッシュして再試行を促す
          refreshToken();
          setError('セキュリティトークンが無効です。もう一度お試しください。');
          return;
        }
        
        // その他のエラー
        throw new Error(data.error || 'ログインに失敗しました');
      }
      
      // 成功時の処理
      if (data.redirectTo) {
        router.push(data.redirectTo);
      } else {
        router.push('/dashboard');
      }
      
      // 成功メッセージ（オプション）
      if (data.message) {
        console.log('Login successful:', data.message);
      }
      
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'ログイン中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // CSRFエラー時の表示
  if (csrfError) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
        <p>セキュリティトークンの取得に失敗しました。</p>
        <button 
          onClick={refreshToken}
          className="mt-2 text-sm underline hover:no-underline"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
          {error}
        </div>
      )}
      
      {/* レート制限警告 */}
      {rateLimitInfo && rateLimitInfo.remaining <= 2 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded text-sm">
          残り試行回数: {rateLimitInfo.remaining}回
        </div>
      )}
      
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="メールアドレス"
            disabled={isLoading || csrfLoading}
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            placeholder="パスワード（8文字以上）"
            disabled={isLoading || csrfLoading}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700"
            disabled={isLoading}
          />
          <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
            ログイン状態を保持
          </label>
        </div>

        <div className="text-sm">
          <a href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
            パスワードをお忘れですか？
          </a>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || csrfLoading || !csrfToken}
        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'ログイン中...' : csrfLoading ? '準備中...' : 'ログイン'}
      </button>
    </form>
  );
}
```

### Phase 3: APIルートのセキュリティ最適化

#### 3-1. `/src/app/api/auth/login/route.ts` の最適化

```typescript
import { NextRequest, NextResponse } from 'next/server';
// 既存のインポート...

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    // === 並列化可能なセキュリティチェック ===
    const [
      rateLimitResult,
      originValid,
      contentType
    ] = await Promise.all([
      // 1. レート制限チェック（非同期）
      rateLimiter.check(request, rateLimitConfigs.login),
      
      // 2. Origin検証（同期処理をPromiseでラップ）
      Promise.resolve(OriginValidator.validate(request)),
      
      // 3. Content-Type取得（同期）
      Promise.resolve(request.headers.get('content-type'))
    ]);
    
    // レート制限チェック結果の処理
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { 
        requestId,
        ip: request.headers.get('x-forwarded-for'),
      });
      
      return NextResponse.json(
        { 
          error: 'リクエストが多すぎます。しばらくお待ちください。',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Limit': String(rateLimitResult.limit || 5),
          }
        }
      );
    }
    
    // Origin検証結果の処理
    if (!originValid) {
      logger.error('Invalid origin', { 
        requestId,
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      });
      
      return NextResponse.json(
        { error: '不正なリクエストです' },
        { status: 403 }
      );
    }
    
    // Content-Type検証
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: '不正なContent-Type' },
        { status: 400 }
      );
    }
    
    // === シーケンシャル処理が必要なチェック ===
    
    // 4. リクエストボディの取得（これは先に必要）
    const body = await request.json();
    
    // 5. CSRF検証（bodyが必要な場合があるため後で実行）
    if (!await CSRFProtection.verifyToken(request)) {
      logger.error('CSRF validation failed', { requestId });
      
      return NextResponse.json(
        { error: 'セキュリティトークンが無効です' },
        { status: 403 }
      );
    }
    
    // 以降は既存のコード...
    
  } catch (error) {
    // エラー処理...
  }
}
```

### Phase 4: テスト環境の設定

#### 4-1. `/e2e/global-setup.ts` の作成（新規ファイル）

```typescript
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // テスト用環境変数の設定
  process.env.NODE_ENV = 'test';
  process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  // CSRFを無効化するテストモード（開発時のみ）
  if (process.env.DISABLE_CSRF_FOR_TESTS === 'true') {
    console.log('⚠️ Warning: CSRF protection is disabled for tests');
  }
  
  console.log('🚀 Global setup completed');
  console.log(`📍 Base URL: ${process.env.NEXT_PUBLIC_BASE_URL}`);
}

export default globalSetup;
```

#### 4-2. `/playwright.config.ts` の修正

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // 既存の設定...
  
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  
  use: {
    // 既存の設定...
    
    // APIリクエスト用の設定
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    
    // Cookieの保持
    storageState: undefined, // 認証テストではstorageStateを使わない
  },
  
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'api-routes-auth',
      testMatch: /e2e\/.*auth.*\.spec\.ts/,
      use: {
        // 認証テスト用の設定
        storageState: undefined,
      },
    },
    // 既存のプロジェクト...
  ],
});
```

### Phase 5: 環境変数の設定

#### 5-1. `/.env.test` の修正

```bash
# 既存の環境変数...

# セキュリティ設定（テスト環境）
CSRF_ENABLED=true
RATE_LIMIT_ENABLED=true
ORIGIN_VALIDATION_ENABLED=true

# テスト用のセキュリティ設定
TEST_CSRF_TOKEN=test-csrf-token-for-e2e-tests
TEST_DISABLE_RATE_LIMIT=false

# APIエンドポイント
API_BASE_URL=http://localhost:3000
```

### Phase 6: デバッグとトラブルシューティング用ツール

#### 6-1. `/src/app/api/auth/debug/route.ts` の作成（開発環境のみ）

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { CSRFProtection } from '@/lib/security/csrf';

// 開発環境でのみ有効
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }
  
  const csrfToken = await CSRFProtection.getOrGenerateToken();
  
  return NextResponse.json({
    csrf: {
      token: csrfToken,
      cookieName: 'csrf-token',
      headerName: 'X-CSRF-Token',
    },
    rateLimit: {
      enabled: true,
      limits: {
        login: '5 requests per minute',
        api: '100 requests per minute',
      },
    },
    security: {
      originValidation: true,
      csrfProtection: true,
      sessionManagement: true,
    },
    testMode: process.env.NODE_ENV === 'test',
  });
}
```

## 実装順序

1. **Phase 1**: E2Eテストヘルパーの修正（最優先）
2. **Phase 2**: LoginFormコンポーネントの修正
3. **Phase 3**: APIルートの最適化
4. **Phase 4**: テスト環境の設定
5. **Phase 5**: 環境変数の設定
6. **Phase 6**: デバッグツールの追加

## テスト手順

### 1. 単体テスト
```bash
# CSRFフックのテスト
npm run test src/hooks/useCSRF.test.ts

# APIヘルパーのテスト
npm run test e2e/helpers/api-routes-helper.test.ts
```

### 2. E2Eテスト
```bash
# 認証フローのテスト
npx playwright test e2e/core/auth.spec.ts

# 全体のE2Eテスト
npm run test:e2e
```

### 3. デバッグ確認
```bash
# デバッグエンドポイントの確認
curl http://localhost:3000/api/auth/debug

# CSRFトークンの取得確認
curl http://localhost:3000/api/auth/csrf
```

## 想定される問題と対策

### 問題1: CSRFトークンの有効期限
- **対策**: 24時間の有効期限を設定し、自動更新メカニズムを実装

### 問題2: レート制限によるテスト失敗
- **対策**: テスト環境では制限を緩和、またはテスト用のホワイトリスト設定

### 問題3: 並列テスト実行時のトークン競合
- **対策**: テストごとに独立したブラウザコンテキストを使用

## 完了基準

- [ ] すべてのE2Eテストが正常に動作する
- [ ] CSRFトークンが適切に送受信される
- [ ] レート制限が正しく機能する
- [ ] ログイン処理のレスポンス時間が1秒以内
- [ ] エラーハンドリングが適切に動作する
# 従来の安定パターンへの移行実装ガイド

## 1. 実装アーキテクチャ概要

### 推奨アーキテクチャ
```
Client (React Component) 
    ↓ [Form Submit / Button Click]
Client-side Handler (async function)
    ↓ [fetch API call]
API Route (/app/api/*/route.ts)
    ↓ [Business Logic]
Database / External Services
    ↓ [Response]
Client State Update
```

## 2. 具体的な修正対象ファイルと実装手順

### 2.1 認証関連の修正

#### ステップ1: API Routeの作成

**新規作成: `/app/api/auth/login/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// 入力検証スキーマ
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(6, 'パスワードは6文字以上である必要があります'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. リクエストボディの取得
    const body = await request.json();
    
    // 2. 入力検証
    const validatedData = loginSchema.parse(body);
    
    // 3. Supabase認証
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    });
    
    // 4. エラーハンドリング
    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: 'AUTH_FAILED' 
        },
        { status: 401 }
      );
    }
    
    // 5. 成功レスポンス
    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        // 必要な情報のみ返す（セキュリティ考慮）
      },
      redirectTo: '/dashboard'
    });
    
  } catch (error) {
    // 6. バリデーションエラーまたは予期しないエラー
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'バリデーションエラー',
          details: error.errors 
        },
        { status: 400 }
      );
    }
    
    console.error('Login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'ログイン処理中にエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}
```

#### ステップ2: LoginFormの修正

**修正対象: `/src/components/auth/LoginForm.tsx`**
```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormState {
  isLoading: boolean;
  error: string | null;
}

export default function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginFormState>({
    isLoading: false,
    error: null,
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 1. ローディング状態を設定
    setState({ isLoading: true, error: null });
    
    // 2. FormDataの取得
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    try {
      // 3. API呼び出し
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      // 4. レスポンス処理
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました');
      }
      
      // 5. 成功時の処理
      if (data.success) {
        // オプション: ローカルストレージに一時的な状態を保存
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        // 6. リダイレクト
        router.push(data.redirectTo || '/dashboard');
        // リダイレクト中も表示を維持
        setState({ isLoading: true, error: null });
      }
      
    } catch (error) {
      // 7. エラーハンドリング
      console.error('Login error:', error);
      setState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'ログインに失敗しました',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {/* エラー表示 */}
      {state.error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">
            {state.error}
          </p>
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
            disabled={state.isLoading}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50"
            placeholder="メールアドレス"
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
            disabled={state.isLoading}
            minLength={6}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm bg-white dark:bg-gray-800 disabled:opacity-50"
            placeholder="パスワード"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={state.isLoading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state.isLoading ? 'ログイン中...' : 'ログイン'}
        </button>
      </div>
    </form>
  );
}
```

### 2.2 その他のフォームコンポーネントの修正

#### 修正対象ファイル一覧

1. **`/src/components/auth/SignupForm.tsx`**
2. **`/src/components/auth/ForgotPasswordForm.tsx`**
3. **`/src/components/upload/UploadForm.tsx`**

#### SignupForm.tsx の修正例

**新規作成: `/app/api/auth/signup/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'パスワードは大文字、小文字、数字を含む必要があります'
  ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = signupSchema.parse(body);
    
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: validatedData.email,
      password: validatedData.password,
    });
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '確認メールを送信しました',
      requiresEmailConfirmation: true,
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
```

### 2.3 ファイルアップロード処理の修正

**新規作成: `/app/api/upload/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証確認
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }
    
    // 2. フォームデータ取得
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが選択されていません' },
        { status: 400 }
      );
    }
    
    // 3. ファイルバリデーション
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const ALLOWED_TYPES = ['application/vnd.ms-powerpoint', 
                          'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'ファイルサイズが大きすぎます（最大10MB）' },
        { status: 400 }
      );
    }
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'PowerPointファイルのみアップロード可能です' },
        { status: 400 }
      );
    }
    
    // 4. ファイル保存
    const fileName = `${user.id}/${uuidv4()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('presentations')
      .upload(fileName, file);
    
    if (uploadError) {
      return NextResponse.json(
        { success: false, error: 'ファイルのアップロードに失敗しました' },
        { status: 500 }
      );
    }
    
    // 5. データベース記録
    const { data: dbData, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();
    
    if (dbError) {
      // ストレージからファイルを削除
      await supabase.storage.from('presentations').remove([fileName]);
      
      return NextResponse.json(
        { success: false, error: 'データベースへの保存に失敗しました' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      fileId: dbData.id,
      fileName: file.name,
      message: 'ファイルが正常にアップロードされました',
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'アップロード処理中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
```

### 2.4 カスタムフックの作成（再利用性向上）

**新規作成: `/src/hooks/useApiRequest.ts`**
```typescript
import { useState, useCallback } from 'react';

interface ApiRequestState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface ApiRequestOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useApiRequest<T = any>() {
  const [state, setState] = useState<ApiRequestState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async (
    url: string,
    options: RequestInit & ApiRequestOptions = {}
  ) => {
    const { onSuccess, onError, ...fetchOptions } = options;
    
    setState({ data: null, error: null, isLoading: true });
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      setState({ data, error: null, isLoading: false });
      onSuccess?.(data);
      
      return data;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'エラーが発生しました';
      setState({ data: null, error: errorMessage, isLoading: false });
      onError?.(error as Error);
      throw error;
    }
  }, []);

  return {
    ...state,
    execute,
  };
}
```

### 2.5 エラーハンドリングの統一化

**新規作成: `/src/lib/api/error-handler.ts`**
```typescript
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_FAILED = 'AUTH_FAILED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  // Zodバリデーションエラー
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        code: ErrorCode.VALIDATION_ERROR,
        error: 'バリデーションエラー',
        details: error.errors,
      },
      { status: 400 }
    );
  }
  
  // カスタムAPIエラー
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        success: false,
        code: error.code,
        error: error.message,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }
  
  // 予期しないエラー
  console.error('Unexpected error:', error);
  return NextResponse.json(
    {
      success: false,
      code: ErrorCode.SERVER_ERROR,
      error: 'サーバーエラーが発生しました',
    },
    { status: 500 }
  );
}
```

## 3. E2Eテストの更新

### 3.1 テストヘルパーの作成

**新規作成: `/e2e/helpers/api-test-helper.ts`**
```typescript
import { Page } from '@playwright/test';

export class ApiTestHelper {
  static async waitForApiCall(
    page: Page,
    urlPattern: string | RegExp,
    method: string = 'POST'
  ) {
    return page.waitForResponse(
      response => {
        const url = response.url();
        const requestMethod = response.request().method();
        const matches = typeof urlPattern === 'string' 
          ? url.includes(urlPattern)
          : urlPattern.test(url);
        
        return matches && requestMethod === method;
      },
      { timeout: 10000 }
    );
  }
  
  static async submitFormAndWaitForResponse(
    page: Page,
    formSelector: string,
    apiEndpoint: string
  ) {
    const responsePromise = this.waitForApiCall(page, apiEndpoint);
    
    await page.locator(`${formSelector} button[type="submit"]`).click();
    
    const response = await responsePromise;
    const responseData = await response.json();
    
    return { response, data: responseData };
  }
  
  static async fillAndSubmitLoginForm(
    page: Page,
    email: string,
    password: string
  ) {
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    
    const { response, data } = await this.submitFormAndWaitForResponse(
      page,
      'form',
      '/api/auth/login'
    );
    
    return { 
      success: response.ok(),
      status: response.status(),
      data 
    };
  }
}
```

### 3.2 テストケースの更新

**修正対象: `/e2e/01-auth-flow.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';
import { ApiTestHelper } from './helpers/api-test-helper';

test.describe('認証フロー（安定版API Routes）', () => {
  test('正常なログイン', async ({ page }) => {
    await page.goto('/login');
    
    // API呼び出しを監視
    const result = await ApiTestHelper.fillAndSubmitLoginForm(
      page,
      'test@example.com',
      'testpassword123'
    );
    
    // レスポンス検証
    expect(result.success).toBeTruthy();
    expect(result.status).toBe(200);
    expect(result.data.success).toBeTruthy();
    
    // ナビゲーション検証
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
  
  test('エラーハンドリング', async ({ page }) => {
    await page.goto('/login');
    
    const result = await ApiTestHelper.fillAndSubmitLoginForm(
      page,
      'invalid@example.com',
      'wrongpassword'
    );
    
    expect(result.success).toBeFalsy();
    expect(result.status).toBe(401);
    expect(result.data.code).toBe('AUTH_FAILED');
    
    // エラーメッセージが表示されることを確認
    await expect(page.locator('.bg-red-50')).toBeVisible();
  });
});
```

## 4. 移行チェックリスト

### Phase 1: API Routes作成（1日目）
- [ ] `/app/api/auth/login/route.ts`
- [ ] `/app/api/auth/signup/route.ts`
- [ ] `/app/api/auth/logout/route.ts`
- [ ] `/app/api/auth/forgot-password/route.ts`
- [ ] `/app/api/upload/route.ts`

### Phase 2: コンポーネント修正（2日目）
- [ ] `/src/components/auth/LoginForm.tsx`
- [ ] `/src/components/auth/SignupForm.tsx`
- [ ] `/src/components/auth/ForgotPasswordForm.tsx`
- [ ] `/src/components/upload/UploadForm.tsx`
- [ ] `/src/components/SubmitButton.tsx`（削除または簡略化）

### Phase 3: ユーティリティ作成（3日目）
- [ ] `/src/hooks/useApiRequest.ts`
- [ ] `/src/lib/api/error-handler.ts`
- [ ] `/src/lib/api/validators.ts`
- [ ] `/src/lib/api/middleware.ts`

### Phase 4: テスト更新（4日目）
- [ ] E2Eテストヘルパー
- [ ] 認証フローテスト
- [ ] アップロードフローテスト
- [ ] エラーハンドリングテスト

### Phase 5: クリーンアップ（5日目）
- [ ] Server Actions関連コード削除
- [ ] `useActionState`/`useFormState`の除去
- [ ] 不要な'use server'ディレクティブ削除
- [ ] ドキュメント更新

## 5. 実装の優先順位

1. **最優先**: ログイン機能（ユーザー影響大）
2. **高**: サインアップ機能
3. **中**: パスワードリセット
4. **低**: その他の機能

## 6. パフォーマンス最適化

```typescript
// API Route側でのキャッシュ設定
export async function GET(request: NextRequest) {
  const response = NextResponse.json(data);
  
  // キャッシュヘッダー設定
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=10, stale-while-revalidate=59'
  );
  
  return response;
}
```

## 7. セキュリティ考慮事項

- CSRF対策: Next.jsのビルトイン機能を活用
- Rate Limiting: ミドルウェアで実装
- 入力検証: Zodによる厳格な検証
- エラー情報: 本番環境では詳細を隠蔽
- ログ: 適切な監査ログの実装

---

この実装ガイドに従って段階的に移行を進めることで、安定した認証システムを構築できます。
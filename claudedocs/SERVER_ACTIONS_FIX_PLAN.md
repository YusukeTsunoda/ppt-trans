# 🚀 Server Actions 修正実装計画 - MVP向け

**作成日**: 2025-08-26  
**目的**: Server Actionsを正しく実装し、セキュリティを強化しながら安定性を確保

---

## 📋 実装優先順位

### Phase 1: Critical Fixes (Day 1-2) 🔴
1. useActionState → useFormState への移行
2. Client Component wrapper の削除
3. Server Actions の正しい分離

### Phase 2: Security Enhancement (Day 3-4) 🟡
1. CSRF Protection の追加
2. Rate Limiting の実装
3. Input Validation の強化

### Phase 3: Testing & Stabilization (Day 5) 🟢
1. E2E テストの修正
2. エラーハンドリングの統一
3. パフォーマンス最適化

---

## 🔧 Phase 1: Critical Fixes 詳細実装

### 1. LoginForm の修正 (最優先)

#### Step 1: Server Action を独立ファイルに移動

**新規作成: `/src/app/actions/auth-actions.ts`**
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import logger from '@/lib/logger';

// バリデーションスキーマ
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
});

// セキュアなログインアクション
export async function loginAction(prevState: any, formData: FormData) {
  try {
    // 1. Origin検証（CSRF対策）
    const headersList = headers();
    const origin = headersList.get('origin');
    const host = headersList.get('host');
    
    if (process.env.NODE_ENV === 'production' && 
        origin !== `https://${host}`) {
      logger.warn('Invalid origin attempt', { origin, host });
      return { 
        error: 'セキュリティエラーが発生しました', 
        success: false 
      };
    }

    // 2. 入力検証
    const validatedFields = loginSchema.safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    if (!validatedFields.success) {
      return { 
        error: validatedFields.error.errors[0].message,
        success: false 
      };
    }

    // 3. Supabase認証
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
    });

    if (error) {
      logger.error('Login failed', { 
        email: validatedFields.data.email.substring(0, 3) + '***',
        error: error.message 
      });
      return { 
        error: 'メールアドレスまたはパスワードが正しくありません',
        success: false 
      };
    }

    // 4. セッション確認
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { 
        error: 'セッションの作成に失敗しました',
        success: false 
      };
    }

    // 5. 成功時のログ
    logger.info('User logged in', { 
      userId: data.user?.id,
      email: validatedFields.data.email.substring(0, 3) + '***'
    });

  } catch (error) {
    logger.error('Login action error', { error });
    return { 
      error: '予期しないエラーが発生しました',
      success: false 
    };
  }

  // リダイレクトはServer Action内で行う
  redirect('/dashboard');
}
```

#### Step 2: LoginForm コンポーネントの修正

**修正: `/src/components/auth/LoginFormFixed.tsx`**
```typescript
// Client Componentマーカーを削除！
// 'use client'; ← 削除

import { loginAction } from '@/app/actions/auth-actions';

// SubmitButtonをServer Component化
async function SubmitButton() {
  // useFormStatusを使わない実装
  return (
    <button
      type="submit"
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
    >
      ログイン
    </button>
  );
}

export default function LoginFormFixed() {
  return (
    <form action={loginAction} className="mt-8 space-y-6">
      <input type="hidden" name="remember" defaultValue="true" />
      
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
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="パスワード"
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
```

#### Step 3: Progressive Enhancement付きLoginForm

**新規作成: `/src/components/auth/LoginFormProgressive.tsx`**
```typescript
import { loginAction } from '@/app/actions/auth-actions';
import LoginFormClient from './LoginFormClient';

// Server Component（Progressive Enhancement対応）
export default function LoginFormProgressive() {
  return (
    <>
      {/* JavaScriptが無効でも動作 */}
      <noscript>
        <form action={loginAction} method="POST" className="mt-8 space-y-6">
          <input
            name="email"
            type="email"
            required
            placeholder="メールアドレス"
            className="w-full px-3 py-2 border rounded-md"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="パスワード"
            className="w-full px-3 py-2 border rounded-md"
          />
          <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md">
            ログイン
          </button>
        </form>
      </noscript>

      {/* JavaScript有効時は高機能版 */}
      <LoginFormClient action={loginAction} />
    </>
  );
}
```

**新規作成: `/src/components/auth/LoginFormClient.tsx`**
```typescript
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
      aria-busy={pending}
    >
      {pending ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          ログイン中...
        </span>
      ) : (
        'ログイン'
      )}
    </button>
  );
}

interface Props {
  action: (prevState: any, formData: FormData) => Promise<any>;
}

export default function LoginFormClient({ action }: Props) {
  const [state, formAction] = useFormState(action, null);
  const router = useRouter();

  // サーバーアクションが成功した場合の処理
  useEffect(() => {
    if (state?.success === false && state?.error) {
      // エラーメッセージを表示（Toastなど）
      console.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error && (
        <div role="alert" className="p-4 bg-red-50 text-red-800 rounded-md">
          {state.error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1 w-full px-3 py-2 border rounded-md"
            aria-describedby={state?.error ? "error-message" : undefined}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full px-3 py-2 border rounded-md"
            minLength={8}
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}
```

### 2. SignupForm の修正

同様のパターンで実装：

**新規作成: `/src/app/actions/signup-actions.ts`**
```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { z } from 'zod';
import logger from '@/lib/logger';

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

export async function signupAction(prevState: any, formData: FormData) {
  // Origin検証
  const headersList = headers();
  const origin = headersList.get('origin');
  
  // 実装続く...
}
```

---

## 🛡️ Phase 2: Security Enhancement 詳細

### 1. CSRF Token実装

**新規作成: `/src/lib/security/csrf.ts`**
```typescript
import crypto from 'crypto';
import { cookies } from 'next/headers';

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function validateCSRFToken(token: string): Promise<boolean> {
  const cookieStore = cookies();
  const storedToken = cookieStore.get('csrf-token');
  
  if (!storedToken || storedToken.value !== token) {
    return false;
  }
  
  return true;
}

export async function setCSRFToken(): Promise<string> {
  const token = generateCSRFToken();
  const cookieStore = cookies();
  
  cookieStore.set('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60, // 1時間
  });
  
  return token;
}
```

### 2. Rate Limiting 強化

**修正: `/src/lib/security/action-limiter.ts`**
```typescript
const actionLimits = new Map<string, { count: number; resetTime: number }>();

export async function checkActionRateLimit(
  action: string, 
  identifier: string
): Promise<boolean> {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const limit = actionLimits.get(key);
  
  if (!limit || now > limit.resetTime) {
    actionLimits.set(key, {
      count: 1,
      resetTime: now + 60000, // 1分間のウィンドウ
    });
    return true;
  }
  
  if (limit.count >= 5) { // 1分間に5回まで
    return false;
  }
  
  limit.count++;
  return true;
}
```

---

## 🧪 Phase 3: Testing Strategy

### 1. E2Eテストの修正

**修正: `/e2e/01-auth-flow.spec.ts`**
```typescript
import { test, expect } from '@playwright/test';

test.describe('認証フロー（Server Actions版）', () => {
  test('ログイン成功', async ({ page }) => {
    await page.goto('/login');
    
    // フォーム入力
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test1234!');
    
    // Server Action実行
    await page.click('button[type="submit"]');
    
    // リダイレクト待機
    await page.waitForURL('/dashboard', { timeout: 5000 });
    
    // 成功確認
    await expect(page).toHaveURL('/dashboard');
  });

  test('バリデーションエラー', async ({ page }) => {
    await page.goto('/login');
    
    // 不正な入力
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', '123');
    
    await page.click('button[type="submit"]');
    
    // エラーメッセージ確認
    await expect(page.locator('[role="alert"]')).toBeVisible();
    await expect(page.locator('[role="alert"]')).toContainText('有効なメールアドレス');
  });

  test('CSRF Protection', async ({ page, context }) => {
    // 異なるoriginからのリクエストをシミュレート
    await context.addCookies([{
      name: 'csrf-token',
      value: 'invalid-token',
      domain: 'localhost',
      path: '/',
    }]);
    
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test1234!');
    await page.click('button[type="submit"]');
    
    // エラー確認
    await expect(page.locator('[role="alert"]')).toContainText('セキュリティエラー');
  });
});
```

### 2. 単体テストの追加

**新規作成: `/tests/actions/auth-actions.test.ts`**
```typescript
import { loginAction } from '@/app/actions/auth-actions';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server');
jest.mock('next/headers', () => ({
  headers: () => ({
    get: (name: string) => {
      if (name === 'origin') return 'https://localhost';
      if (name === 'host') return 'localhost';
      return null;
    }
  })
}));

describe('loginAction', () => {
  it('正常なログイン処理', async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: '123' } },
          error: null
        }),
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: '123' } } }
        })
      }
    };
    
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    
    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'Test1234!');
    
    const result = await loginAction(null, formData);
    
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
    // redirect が呼ばれることを確認
  });
});
```

---

## 📅 実装スケジュール

### Day 1-2: Critical Fixes
- [ ] 9:00-12:00: LoginForm修正
- [ ] 13:00-15:00: SignupForm修正  
- [ ] 15:00-17:00: ForgotPasswordForm修正
- [ ] 17:00-18:00: 動作確認

### Day 3-4: Security
- [ ] 9:00-11:00: CSRF実装
- [ ] 11:00-13:00: Rate Limiting
- [ ] 14:00-16:00: Validation強化
- [ ] 16:00-18:00: Audit Logging

### Day 5: Testing
- [ ] 9:00-12:00: E2Eテスト修正
- [ ] 13:00-15:00: 単体テスト追加
- [ ] 15:00-17:00: 統合テスト
- [ ] 17:00-18:00: デプロイ準備

---

## ✅ チェックリスト

### Server Actions修正
- [ ] useActionState → useFormState
- [ ] Client Component wrapper削除
- [ ] Server Component化
- [ ] Progressive Enhancement

### セキュリティ
- [ ] Origin検証
- [ ] CSRF Token
- [ ] Rate Limiting
- [ ] Input Validation
- [ ] Error Sanitization

### テスト
- [ ] E2Eテスト修正
- [ ] 単体テスト追加
- [ ] セキュリティテスト
- [ ] パフォーマンステスト

---

## 🚀 次のステップ

1. **まずLoginFormから修正開始**（最も使用頻度が高い）
2. **動作確認後、他のフォームに展開**
3. **セキュリティ強化を段階的に実装**
4. **本番環境でのA/Bテスト検討**

この計画に従って実装を進めることで、安定したServer Actions実装が完成します。
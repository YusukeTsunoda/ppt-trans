# 完全なAPI Routes移行計画

## 🎯 移行方針

**結論: Server ActionsからAPI Routesへ完全移行**

### 理由
1. **統一性**: 現在Server ActionsとAPI Routesが混在して混乱を招いている
2. **テスト容易性**: E2EテストでAPI呼び出しを監視しやすい
3. **外部サービス連携**: Supabase等の外部サービスとの連携が明確
4. **デバッグ容易性**: ネットワークタブでリクエスト/レスポンスを確認可能
5. **エラーハンドリング**: HTTPステータスコードによる標準的なエラー処理

## 📋 現状分析

### 現在のファイル構成
```
src/
├── app/
│   ├── actions/           # Server Actions (削除予定)
│   │   ├── auth-actions.ts
│   │   ├── upload-actions.ts
│   │   ├── signup-actions.ts
│   │   └── forgot-password-actions.ts
│   └── api/              # API Routes (保持・拡張)
│       └── auth/
│           └── login/route.ts (既存)
├── components/
│   ├── auth/            # 複数バージョンが混在
│   │   ├── LoginForm.tsx         # Server Actions使用
│   │   ├── LoginFormFixed.tsx    # 現在使用中
│   │   ├── LoginFormClient.tsx   # Client Component
│   │   └── LoginFormStable.tsx   # API Routes用？
│   └── upload/
│       └── UploadForm.tsx        # Server Actions使用
```

## 🔄 詳細な修正計画

### Phase 1: API Routes実装の完成（優先度: 高）

#### 1.1 認証関連API Routes

##### `/app/api/auth/login/route.ts` ✅ 既存（調整のみ）
```typescript
// 既存のコードを確認し、以下を保証：
// - 適切なエラーハンドリング
// - セキュリティヘッダー
// - レート制限
```

##### `/app/api/auth/signup/route.ts` 🆕 新規作成
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import logger from '@/lib/logger';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, 'パスワードは8文字以上')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'パスワードは大文字、小文字、数字を含む必要があります'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  // 実装内容...
}
```

##### `/app/api/auth/logout/route.ts` 🆕 新規作成
```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  return NextResponse.json({ success: true });
}
```

##### `/app/api/auth/forgot-password/route.ts` 🆕 新規作成

#### 1.2 アップロード関連API Routes

##### `/app/api/upload/route.ts` 🆕 新規作成
```typescript
export async function POST(request: NextRequest) {
  // FormDataからファイルを取得
  // ファイルバリデーション
  // Supabase Storageへアップロード
  // データベースへ記録
}
```

### Phase 2: コンポーネントの修正（優先度: 高）

#### 2.1 LoginFormの統一

##### 削除対象ファイル:
- `src/components/auth/LoginForm.tsx` (Server Actions版)
- `src/components/auth/LoginFormFixed.tsx` (混在版)
- `src/components/auth/LoginFormClient.tsx` (旧Client版)

##### 保持・修正:
`src/components/auth/LoginFormStable.tsx` → `LoginForm.tsx`にリネーム

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password'),
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'ログインに失敗しました');
      }
      
      router.push('/dashboard');
      router.refresh(); // RSCのキャッシュをリフレッシュ
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* フォームUI */}
    </form>
  );
}
```

#### 2.2 他のフォームコンポーネント修正

同様のパターンで以下を修正:
- `SignupForm.tsx`
- `ForgotPasswordForm.tsx`
- `UploadForm.tsx`

### Phase 3: Server Actions削除（優先度: 中）

#### 3.1 削除対象ファイル
```
src/app/actions/
├── auth-actions.ts        ❌ 削除
├── upload-actions.ts      ❌ 削除
├── signup-actions.ts      ❌ 削除
├── forgot-password-actions.ts ❌ 削除
├── auth.ts               ⚠️ 要確認
├── upload.ts             ⚠️ 要確認
├── dashboard.ts          ✅ 保持（データ取得用）
├── files.ts              ✅ 保持（データ取得用）
├── generation.ts         ✅ 保持（生成処理）
└── profile.ts            ✅ 保持（プロフィール更新）
```

### Phase 4: ページコンポーネント更新（優先度: 中）

#### 4.1 `/app/login/page.tsx`
```typescript
import LoginForm from '@/components/auth/LoginForm'; // 統一されたコンポーネント

export default function LoginPage() {
  return (
    <div className="...">
      <LoginForm />
    </div>
  );
}
```

#### 4.2 同様に更新
- `/app/register/page.tsx`
- `/app/forgot-password/page.tsx`
- `/app/upload/page.tsx`

### Phase 5: E2Eテスト更新（優先度: 高）

#### 5.1 テストヘルパー作成

`/e2e/helpers/api-helper.ts`:
```typescript
export class ApiHelper {
  static async waitForApiCall(page: Page, endpoint: string) {
    return page.waitForResponse(
      response => response.url().includes(endpoint)
    );
  }

  static async submitFormWithApi(
    page: Page, 
    formSelector: string,
    expectedEndpoint: string
  ) {
    const responsePromise = this.waitForApiCall(page, expectedEndpoint);
    await page.locator(formSelector).submit();
    return responsePromise;
  }
}
```

#### 5.2 テストケース修正

`/e2e/core/auth.spec.ts`:
```typescript
test('ログイン', async ({ page }) => {
  await page.goto('/login');
  
  // API呼び出しを監視
  const responsePromise = ApiHelper.waitForApiCall(page, '/api/auth/login');
  
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  
  await expect(page).toHaveURL(/dashboard/);
});
```

### Phase 6: ミドルウェアとセキュリティ（優先度: 高）

#### 6.1 レート制限追加

`/src/lib/api/rate-limit.ts`:
```typescript
import { LRUCache } from 'lru-cache';

const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 60 * 1000, // 1分
});

export async function rateLimit(
  ip: string, 
  limit: number = 5
): Promise<boolean> {
  const count = rateLimitCache.get(ip) || 0;
  
  if (count >= limit) {
    return false;
  }
  
  rateLimitCache.set(ip, count + 1);
  return true;
}
```

#### 6.2 共通エラーハンドラー

`/src/lib/api/error-handler.ts`:
```typescript
export function handleApiError(error: unknown): NextResponse {
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
  
  // 他のエラーハンドリング...
}
```

## 📅 実装スケジュール

### Day 1: API Routes実装
- [ ] `/api/auth/signup/route.ts`
- [ ] `/api/auth/logout/route.ts`
- [ ] `/api/auth/forgot-password/route.ts`
- [ ] `/api/upload/route.ts`

### Day 2: コンポーネント修正
- [ ] LoginForm統一化
- [ ] SignupForm修正
- [ ] ForgotPasswordForm修正
- [ ] UploadForm修正

### Day 3: クリーンアップ
- [ ] Server Actions削除
- [ ] 重複コンポーネント削除
- [ ] ページコンポーネント更新

### Day 4: テスト修正
- [ ] E2Eテストヘルパー作成
- [ ] 全E2Eテスト修正
- [ ] 統合テスト実行

### Day 5: 最終確認
- [ ] 全機能の動作確認
- [ ] パフォーマンステスト
- [ ] セキュリティレビュー
- [ ] ドキュメント更新

## ✅ 成功基準

1. **統一性**: すべての認証・アップロード処理がAPI Routes経由
2. **テスト**: 全E2Eテストが成功
3. **パフォーマンス**: 応答時間 < 200ms
4. **セキュリティ**: レート制限、CSRF対策実装
5. **保守性**: コードの重複なし、明確な責任分離

## ⚠️ リスクと対策

### リスク1: セッション管理の問題
**対策**: Supabaseのセッション管理を適切に実装、cookieの設定確認

### リスク2: CSRF攻撃
**対策**: Next.jsの組み込みCSRF対策を活用、Originヘッダー検証

### リスク3: ファイルアップロードのサイズ制限
**対策**: Next.jsのbodyParserLimitを設定、クライアント側でも検証

### リスク4: 既存機能の破壊
**対策**: 段階的移行、feature flagによる切り替え

## 📝 移行後のアーキテクチャ

```
Client (React Component)
    ↓ [Form Submit / fetch()]
API Route (/app/api/*/route.ts)
    ↓ [Business Logic]
External Services (Supabase, etc.)
    ↓ [Response]
Client State Update
```

## 🚀 次のステップ

1. この計画のレビューと承認
2. Day 1の実装開始
3. 日次進捗確認
4. 問題発生時の即時対応

---

この計画に従って、統一された安定したAPIアーキテクチャを実現します。
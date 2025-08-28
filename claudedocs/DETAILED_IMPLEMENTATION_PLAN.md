# 🔧 詳細実装計画書 - PPT Translator Application

**作成日**: 2025-08-26  
**優先度**: 🔴 Critical → 🟡 Important → 🟢 Nice to Have

---

## 🔴 Priority 1: Server Actions → API Routes 移行 (今週中)

### 1. SignupForm の移行

#### 対象ファイル
- `/src/components/auth/SignupForm.tsx`
- `/src/app/actions/auth.ts` (signupAction)

#### 実装手順

**Step 1: API Route作成**
```typescript
// 新規作成: /src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  confirmPassword: z.string()
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
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
      }
    });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '確認メールを送信しました' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 });
  }
}
```

**Step 2: SignupFormStable作成**
```typescript
// 新規作成: /src/components/auth/SignupFormStable.tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupFormStable() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '登録に失敗しました');
        return;
      }

      setSuccess(data.message);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      setError('ネットワークエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields... */}
    </form>
  );
}
```

### 2. ForgotPasswordForm の移行

#### 対象ファイル
- `/src/components/auth/ForgotPasswordForm.tsx`
- `/src/app/actions/auth.ts` (forgotPasswordAction)

#### 実装内容
- `/src/app/api/auth/forgot-password/route.ts` を作成
- ForgotPasswordFormStable.tsx を作成
- 同様のfetchパターンを実装

### 3. UploadForm の移行

#### 対象ファイル  
- `/src/components/upload/UploadForm.tsx`
- `/src/app/actions/upload.ts` (uploadFileAction)

#### 特別な考慮事項
- multipart/form-data の処理が必要
- FormData APIを使用したファイルアップロード
- プログレストラッキングの実装

---

## 🔴 Priority 2: TypeScript `any` 型の除去 (今週中)

### 最優先で修正すべきファイル（影響度が高い順）

#### 1. `/src/lib/optimization/backend-optimization.ts` (10個のany)

**現在のコード**:
```typescript
// Line 27-28
resolve: (value: any) => void;
reject: (error: any) => void;
```

**修正後**:
```typescript
resolve: (value: QueryResult<T>) => void;
reject: (error: Error) => void;
```

**Line 99**:
```typescript
// 現在
generateKey(operation: string, params: any): string

// 修正後
generateKey(operation: string, params: Record<string, unknown>): string
```

**Line 238**:
```typescript
// 現在
set(key: string, value: any, ttl?: number): void

// 修正後
set<T>(key: string, value: T, ttl?: number): void
```

#### 2. `/src/app/preview/[id]/PreviewView.tsx` (6個のany)

**修正内容**:
```typescript
// 適切な型定義を作成
interface TranslationText {
  id: string;
  original: string;
  translated: string;
  confidence?: number;
}

interface SlideContent {
  slideNumber: number;
  texts: TranslationText[];
  images?: string[];
}

// anyを置き換え
const [slides, setSlides] = useState<SlideContent[]>([]);
```

#### 3. `/src/lib/validation/schemas.ts` (3個のany)

**修正内容**:
```typescript
// 現在
const validateData = (data: any) => { ... }

// 修正後
const validateData = (data: unknown): ValidationResult => {
  // zodを使用した適切な型検証
  return schema.safeParse(data);
}
```

### 型定義ファイルの作成

**新規作成: `/src/types/backend.ts`**
```typescript
export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CacheEntry<T> {
  value: T;
  expires: number;
}

export interface BatchItem<T, R> {
  item: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
}
```

---

## 🟡 Priority 3: console.* の除去 (今スプリント中)

### 修正対象ファイル一覧

#### 1. `/src/hooks/usePreviewOperations.ts`

**Line 88, 144**:
```typescript
// 現在
console.error('Extraction error:', error);

// 修正後
import logger from '@/lib/logger';
logger.error('Extraction error:', { error, fileId });
```

#### 2. `/src/components/auth/LoginFormStable.tsx`

```typescript
// 現在
console.error('Login error:', error);

// 修正後  
import logger from '@/lib/logger';
logger.error('Login error:', { 
  error, 
  email: email.substring(0, 3) + '***' // 個人情報をマスク
});
```

#### 3. `/src/lib/translation/translator.ts`

**Line 31**:
```typescript
// 現在
console.error('Translation error:', error);

// 修正後
import logger from '@/lib/logger';
logger.error('Translation API error:', {
  error,
  targetLanguage,
  textLength: text.length
});
```

### Logger設定の更新

**修正: `/src/lib/logger.ts`**
```typescript
// 環境別のログレベル設定を追加
const LOG_LEVELS = {
  development: ['debug', 'info', 'warn', 'error'],
  test: ['error'],
  production: ['warn', 'error']
} as const;

const currentLevel = LOG_LEVELS[process.env.NODE_ENV || 'development'];

// ログ出力の改善
export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => {
    if (!currentLevel.includes('debug')) return;
    // 構造化ログとして出力
  },
  // ... 他のメソッド
};
```

---

## 🟡 Priority 4: バンドルサイズ最適化 (今スプリント中)

### 1. 動的インポートの追加

**対象コンポーネント**:
- `/src/components/preview/PreviewScreen.tsx` (大きいコンポーネント)
- `/src/components/dashboard/DashboardView.tsx`
- `/src/app/admin/AdminDashboardClient.tsx`

**実装例**:
```typescript
// /src/app/preview/[id]/page.tsx
const PreviewView = dynamic(
  () => import('./PreviewView'),
  { 
    loading: () => <PreviewSkeleton />,
    ssr: false // クライアントサイドのみ
  }
);
```

### 2. 未使用の依存関係の削除

**調査コマンド**:
```bash
npm run analyze  # Bundle Analyzerを実行
npx depcheck    # 未使用パッケージの検出
```

**削除候補**:
- 開発のみで使用するパッケージをdevDependenciesに移動
- 未使用のパッケージを削除

### 3. Tree Shakingの最適化

**修正: `/src/lib/utils/index.ts`**
```typescript
// 現在（全体をエクスポート）
export * from './file-chunking';
export * from './retry';

// 修正後（名前付きエクスポート）
export { chunkFile, mergeChunks } from './file-chunking';
export { retry, RetryOptions } from './retry';
```

---

## 🟢 Priority 5: テストカバレッジの向上 (次スプリント)

### 1. 新規API Routesのテスト追加

**作成するテストファイル**:
- `/tests/api/auth/login.test.ts`
- `/tests/api/auth/signup.test.ts`
- `/tests/api/auth/forgot-password.test.ts`

**テスト例**:
```typescript
// /tests/api/auth/login.test.ts
describe('POST /api/auth/login', () => {
  it('正常なログイン', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('無効な認証情報', async () => {
    // ...
  });
});
```

### 2. E2Eテストの拡充

**追加するシナリオ**:
- ユーザー登録フロー完全版
- パスワードリセットフロー
- ファイルアップロード〜翻訳完了フロー

---

## 📊 実装スケジュール

### Week 1 (今週)
| 曜日 | タスク | 担当 | 見積時間 |
|------|--------|------|----------|
| 月 | SignupForm API Routes移行 | - | 3h |
| 火 | ForgotPasswordForm移行 | - | 2h |
| 水 | UploadForm移行 | - | 4h |
| 木 | any型除去（優先度高） | - | 4h |
| 金 | テスト・動作確認 | - | 3h |

### Week 2 (来週)
| 曜日 | タスク | 担当 | 見積時間 |
|------|--------|------|----------|
| 月 | console.log除去 | - | 2h |
| 火 | Logger設定改善 | - | 2h |
| 水 | バンドル分析・最適化 | - | 3h |
| 木 | 動的インポート実装 | - | 3h |
| 金 | テスト追加・カバレッジ確認 | - | 4h |

---

## ✅ 成功基準

1. **Server Actions移行**
   - すべてのフォームがAPI Routes経由で動作
   - E2Eテストがすべてパス
   - エラーハンドリングが一貫している

2. **型安全性**
   - strictモードでビルドエラーなし
   - any型の使用を20個以下に削減
   - 型定義ファイルの整備完了

3. **パフォーマンス**
   - 初回ロード時間を20%削減
   - バンドルサイズを15%削減
   - Lighthouse スコア90以上

4. **コード品質**
   - console.*の使用ゼロ
   - ESLintエラーゼロ
   - テストカバレッジ80%以上

---

## 🚨 リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| API Routes移行での既存機能の破損 | 高 | Feature flagで段階的移行 |
| 型定義変更による広範囲な影響 | 中 | 段階的な型付け、CI/CDでの型チェック |
| パフォーマンス最適化での副作用 | 低 | A/Bテスト、段階的リリース |

---

*この実装計画は定期的に見直し、進捗に応じて調整することを推奨します。*
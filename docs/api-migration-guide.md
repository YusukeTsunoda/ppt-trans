# API Migration Guide: RESTful API to Server Actions

## 概要

このプロジェクトでは、従来のRESTful APIエンドポイントをNext.js 14のServer Actionsに移行しています。
この移行により、以下の利点が得られます：

- **型安全性の向上**: TypeScriptの完全な型推論
- **パフォーマンスの改善**: ネットワークオーバーヘッドの削減
- **セキュリティの強化**: 自動的なCSRF保護
- **開発体験の向上**: シンプルなコード構造

## 廃止スケジュール

- **廃止通知開始**: 2024年12月
- **新規利用停止**: 2025年1月
- **完全廃止**: 2025年2月

## 移行マッピング

### 認証関連

| 廃止されるAPI | 新しいServer Action | インポート元 |
|---|---|---|
| `POST /api/auth/register` | `registerUser()` | `@/server-actions/auth/register` |
| `POST /api/auth/renew-session` | `renewSession()` | `@/server-actions/auth/session` |

**移行例:**

```typescript
// 旧: APIエンドポイント
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, name })
});
const data = await response.json();

// 新: Server Action
import { registerUser } from '@/server-actions/auth/register';

const formData = new FormData();
formData.append('email', email);
formData.append('password', password);
formData.append('name', name);
const result = await registerUser(formData);
```

### ファイル操作

| 廃止されるAPI | 新しいServer Action | インポート元 |
|---|---|---|
| `GET /api/files` | `listFiles()` | `@/server-actions/files/list` |
| `POST /api/files` | `uploadFile()` | `@/server-actions/files/upload` |
| `DELETE /api/files/:id` | `deleteFile()` | `@/server-actions/files/delete` |
| `POST /api/process-pptx` | `uploadFile()` | `@/server-actions/files/upload` |

**移行例:**

```typescript
// 旧: APIエンドポイント
const response = await fetch('/api/files');
const files = await response.json();

// 新: Server Action
import { listFiles } from '@/server-actions/files/list';

const result = await listFiles({
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
});
```

### プロファイル管理

| 廃止されるAPI | 新しいServer Action | インポート元 |
|---|---|---|
| `GET /api/profile` | Next.js Session | `next-auth` |
| `PUT /api/profile` | `updateProfile()` | `@/server-actions/profile/update` |
| `POST /api/profile/avatar` | `uploadAvatar()` | `@/server-actions/profile/update` |
| `PUT /api/profile/settings` | `updateSettings()` | `@/server-actions/settings/update` |

**移行例:**

```typescript
// 旧: APIエンドポイント
const response = await fetch('/api/profile', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, bio, location })
});

// 新: Server Action
import { updateProfile } from '@/server-actions/profile/update';

const formData = new FormData();
formData.append('name', name);
formData.append('bio', bio);
formData.append('location', location);
const result = await updateProfile(formData);
```

### 翻訳処理

| 廃止されるAPI | 新しいServer Action | インポート元 |
|---|---|---|
| `POST /api/translate` | `translateText()` / `batchTranslate()` | `@/server-actions/translate/process` |
| `POST /api/generate-pptx` | `generatePptx()` | `@/server-actions/generate/pptx` |
| `GET /api/generation-status/:id` | `getGenerationJobStatus()` | `@/server-actions/generate/pptx` |
| `GET /api/queue/status` | `getTranslationJobStatus()` | `@/server-actions/translate/process` |

**移行例:**

```typescript
// 旧: APIエンドポイント
const response = await fetch('/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: [{ id: '1', originalText: 'Hello' }],
    targetLanguage: 'Japanese'
  })
});

// 新: Server Action
import { batchTranslate } from '@/server-actions/translate/process';

const result = await batchTranslate({
  texts: [{ id: '1', text: 'Hello' }],
  targetLanguage: 'Japanese',
  model: 'claude-3-sonnet-20240229'
});
```

### 管理者機能

| 廃止されるAPI | 新しいServer Action | インポート元 |
|---|---|---|
| `GET /api/admin/users` | `getUsers()` | `@/server-actions/admin/users` |
| `GET /api/admin/stats` | `getDashboardStats()` | `@/server-actions/admin/stats` |
| `GET /api/admin/activities` | `getAuditLogs()` | `@/server-actions/admin/stats` |
| `GET /api/admin/detailed-stats` | `getUserStats()` / `getFileStats()` | `@/server-actions/admin/stats` |

## Server Actionsの使用方法

### 1. クライアントコンポーネントでの使用

```tsx
'use client';

import { useState } from 'react';
import { translateText } from '@/server-actions/translate/process';

export function TranslateForm() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    try {
      const result = await translateText(formData);
      if (result.success) {
        console.log('Translation:', result.data.translatedText);
      } else {
        console.error('Error:', result.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <textarea name="text" required />
      <select name="targetLanguage">
        <option value="Japanese">日本語</option>
        <option value="English">英語</option>
      </select>
      <button type="submit" disabled={isLoading}>
        {isLoading ? '翻訳中...' : '翻訳'}
      </button>
    </form>
  );
}
```

### 2. サーバーコンポーネントでの使用

```tsx
import { listFiles } from '@/server-actions/files/list';

export default async function FilesPage() {
  const result = await listFiles({
    page: 1,
    limit: 20
  });

  if (!result.success) {
    return <div>エラー: {result.error}</div>;
  }

  return (
    <div>
      {result.data.files.map(file => (
        <div key={file.id}>{file.fileName}</div>
      ))}
    </div>
  );
}
```

### 3. useFormStateとuseFormStatusの活用

```tsx
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateProfile } from '@/server-actions/profile/update';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? '保存中...' : '保存'}
    </button>
  );
}

export function ProfileForm({ initialData }) {
  const [state, formAction] = useFormState(updateProfile, {
    success: false,
    error: null
  });

  return (
    <form action={formAction}>
      {state.error && <div className="error">{state.error}</div>}
      {state.success && <div className="success">保存しました</div>}
      
      <input name="name" defaultValue={initialData.name} />
      <input name="email" defaultValue={initialData.email} />
      <SubmitButton />
    </form>
  );
}
```

## エラーハンドリング

Server Actionsは一貫したエラーハンドリングパターンを提供します：

```typescript
interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 使用例
const result = await someServerAction(formData);

if (result.success) {
  // 成功時の処理
  console.log(result.data);
} else {
  // エラー時の処理
  console.error(result.error);
}
```

## 認証とセキュリティ

Server Actionsは自動的に以下のセキュリティ機能を提供します：

- **CSRF保護**: 自動的に適用
- **認証チェック**: 各Server Action内で実装
- **入力検証**: Zodスキーマによる自動検証
- **監査ログ**: すべての操作を自動記録

## パフォーマンスの最適化

### 1. キャッシュの再検証

```typescript
import { revalidatePath, revalidateTag } from 'next/cache';

export async function updateData(formData: FormData) {
  // データ更新処理
  
  // 特定のパスを再検証
  revalidatePath('/dashboard');
  
  // タグベースの再検証
  revalidateTag('files');
}
```

### 2. Optimistic Updates

```tsx
'use client';

import { useOptimistic } from 'react';

export function FileList({ files }) {
  const [optimisticFiles, addOptimisticFile] = useOptimistic(
    files,
    (state, newFile) => [...state, newFile]
  );

  async function handleUpload(formData: FormData) {
    const tempFile = {
      id: 'temp',
      fileName: formData.get('file').name,
      status: 'uploading'
    };
    
    addOptimisticFile(tempFile);
    const result = await uploadFile(formData);
    // 実際のデータで更新
  }
}
```

## トラブルシューティング

### よくある問題と解決方法

1. **「'use server'ディレクティブがありません」エラー**
   - Server Actionファイルの先頭に`'use server'`を追加

2. **「FormDataが空です」エラー**
   - フォーム要素に`name`属性を設定

3. **「認証が必要です」エラー**
   - セッションが有効か確認
   - NextAuth.jsの設定を確認

4. **「CORS」エラー**
   - Server ActionsはCORSの影響を受けません
   - 外部APIを直接呼び出していないか確認

## サポート

移行に関する質問や問題がある場合は、以下のリソースを参照してください：

- [Next.js Server Actions ドキュメント](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions)
- [プロジェクトGitHub Issues](https://github.com/your-org/your-repo/issues)
- 社内Slackチャンネル: #nextjs-migration

## 付録: 廃止APIのレスポンス形式

廃止されたAPIエンドポイントにアクセスすると、以下の形式でレスポンスが返されます：

```json
{
  "error": "Deprecated API",
  "message": "This API endpoint has been deprecated. Please use translateText instead.",
  "deprecated": true,
  "endpoint": "/api/translate",
  "replacement": {
    "method": "Server Action: translateText",
    "module": "@/server-actions/translate/process"
  },
  "documentation": "https://docs.example.com/migration/server-actions"
}
```

HTTPヘッダー：
- `X-Deprecated: true`
- `X-Replacement: Server Action: translateText`
- `Deprecation: Date="2024-12-01T00:00:00.000Z"`
- `Sunset: 2025-02-01T00:00:00.000Z`
# Server Actions動作不良の根本原因分析

## 発見された真の原因

### 1. バージョンの組み合わせ問題
- **Next.js**: 15.4.6
- **React**: 19.1.0
- **React DOM**: 19.1.0

これらは最新のcanary/experimental版であり、安定版ではありません。

### 2. Client ComponentでのServer Actions使用問題

```typescript
'use client';  // ← Client Component宣言

import { useActionState } from 'react';  // React 19の新API
// ...
const [state, formAction] = useActionState(loginWrapper, null);
// ...
<form action={formAction}>  // ← Server Actionを渡そうとしている
```

**問題点**：
- Client Componentで`useActionState`を使用している
- `loginWrapper`関数がクライアント側で定義されている
- Server Action (`loginAction`) をClient Component内でラップしている

### 3. Server Actionの正しい実装パターンからの逸脱

#### 現在の実装（誤り）
```typescript
// LoginForm.tsx (Client Component)
'use client';

async function loginWrapper(prevState, formData) {
  return loginAction(formData);  // Server Actionをクライアントで呼び出し
}

const [state, formAction] = useActionState(loginWrapper, null);
```

#### 正しい実装パターン
```typescript
// Option 1: Server Componentで直接使用
// LoginForm.tsx (Server Component - 'use client'を削除)
import { loginAction } from '@/app/actions/auth';

export default function LoginForm() {
  return <form action={loginAction}>...</form>;
}
```

または

```typescript
// Option 2: useFormStateを使用（React 19）
'use client';
import { useFormState } from 'react-dom';  // react-domから
import { loginAction } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, null);
  return <form action={formAction}>...</form>;
}
```

### 4. 開発環境でのハイドレーション失敗

デバッグ結果：
- `hasRoot: false` - Reactのルートが見つからない
- `hasServerMarkers: false` - Server Component/Actionのマーカーがない
- `action: "javascript:throw..."` - Server Actionがシリアライズされていない

これは、Server ActionがクライアントサイドでJavaScript関数として扱われており、サーバーへのRPCとして処理されていないことを示しています。

### 5. useActionState vs useFormState の混乱

React 19では：
- `useFormState` → Server Actions用（react-domから）
- `useActionState` → 汎用的な状態管理（reactから）

現在の実装は`useActionState`を使用していますが、Server Actionsには`useFormState`を使うべきです。

## 解決策

### 即座の修正方法

#### 方法1: useFormStateに変更
```typescript
'use client';
import { useFormState } from 'react-dom';  // react-domから
import { loginAction } from '@/app/actions/auth';

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, null);
  // ...
}
```

#### 方法2: Server Componentに変更
```typescript
// 'use client'を削除
import { loginAction } from '@/app/actions/auth';

export default async function LoginForm() {
  return (
    <form action={loginAction}>
      {/* ... */}
    </form>
  );
}
```

#### 方法3: 従来のパターンに戻す
```typescript
'use client';

export default function LoginForm() {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      body: formData,
    });
    // ...
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

## なぜこの問題が発生したか

1. **Next.js 15とReact 19は実験的バージョン**
   - まだ安定していない機能が多い
   - APIが頻繁に変更される

2. **ドキュメントの混乱**
   - React 19のドキュメントはまだ完全ではない
   - `useActionState`と`useFormState`の使い分けが不明確

3. **開発環境特有の問題**
   - プロダクションビルドでは動作する可能性がある
   - 開発サーバーのホットリロードがServer Actionsと相性が悪い

## 推奨事項

### 短期的対応
1. `useFormState`（react-dom）に変更してテスト
2. それでも動作しない場合は、従来のfetch APIパターンに戻す
3. Next.js 14の安定版にダウングレードを検討

### 長期的対応
1. React 18.2 + Next.js 14の安定版を使用
2. Server Actionsは本番環境で十分テストされるまで待つ
3. 段階的に新機能を導入する

## 結論

問題の真の原因は：
- **Client ComponentでServer Actionを使用しようとしている**
- **`useActionState`（React）を使用すべきところで`useFormState`（React DOM）を使うべき**
- **Next.js 15とReact 19の実験的な組み合わせによる互換性問題**

これらの問題により、Server Actionsがクライアントサイドで正しくシリアライズ・ハイドレートされず、通常のJavaScript関数として扱われてしまっています。
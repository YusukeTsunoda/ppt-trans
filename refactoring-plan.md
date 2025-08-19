# リファクタリング計画書 - MVP向け最適化版

## エグゼクティブサマリー
今回追加した機能について、MVPの観点から必要最小限の改善に絞り込んだ実践的な計画書です。
**重要**: Server Actionsの使用を継続し、CSRFセキュリティを維持しながら品質を向上させます。

---

## 改善方針の基本原則

### ✅ 採用する方針
1. **Server Actionsの継続使用** - CSRF保護が組み込まれている
2. **最小限のリファクタリング** - MVPに必要な改善のみ
3. **即効性のある改善** - 1-2週間で実装可能
4. **既存アーキテクチャの尊重** - 大規模な変更を避ける

### ❌ 採用しない方針（過剰な改善）
1. ~~API Routesへの移行~~ → Server Actionsを維持
2. ~~Zustand等の状態管理ライブラリ~~ → 現状のuseStateで十分
3. ~~依存性注入パターン~~ → MVPには過剰
4. ~~Sentryなどの外部監視ツール~~ → 後回し

---

## 1. 必須の改善項目（MVP向け）

### 1.1 Server Actionsの改善（API移行は不要）

#### 現状の問題点
```typescript
// FormDataの手動作成が冗長
const handleDeleteFile = async (fileId: string) => {
  const formData = new FormData();
  formData.append('fileId', fileId);
  const deleteResult = await deleteFileAction(null, formData);
};
```

#### 改善提案（Server Actions維持）
```typescript
// Server Actionをより使いやすく
// actions/dashboard.ts
export async function deleteFileAction(fileId: string) {
  'use server';
  
  // CSRF保護は自動的に適用される
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: '認証が必要です' };
  }
  
  // 処理実行
  return deleteFile(fileId, user.id);
}

// クライアント側をシンプルに
const handleDelete = async (fileId: string) => {
  const result = await deleteFileAction(fileId);
  if (result.success) {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }
};
```

### 1.2 最小限のコンポーネント分割

#### PreviewView.tsx（839行）を機能単位で分割

```typescript
// 現実的な分割案（3つのみ）
// components/preview/
├── PreviewView.tsx         // メインコンテナ（200行）
├── SlideContent.tsx        // スライド表示部分（300行）
├── TranslationEditor.tsx   // 翻訳・編集機能（200行）
└── hooks/
    └── usePreview.ts       // 共通ロジック（150行）
```

**実装期間**: 1日

### 1.3 エラーハンドリングの統一（シンプル版）

#### トースト通知の簡易実装
```typescript
// components/Toast.tsx（30行程度）
export function Toast({ message, type }: ToastProps) {
  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg ${
      type === 'error' ? 'bg-red-500' : 'bg-green-500'
    } text-white animate-slideIn`}>
      {message}
    </div>
  );
}

// hooks/useToast.ts（20行程度）
export function useToast() {
  const [toast, setToast] = useState(null);
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  return { toast, showToast };
}
```

**実装期間**: 2-3時間

---

## 2. 推奨される改善（優先度: 中）

### 2.1 基本的なパフォーマンス最適化

#### React.memoの選択的適用
```typescript
// 重いコンポーネントのみメモ化
const FileCard = React.memo(({ file, onDelete }) => {
  // 実装
}, (prevProps, nextProps) => {
  return prevProps.file.id === nextProps.file.id;
});

// useMemoは計算コストが高い箇所のみ
const sortedTexts = useMemo(() => {
  return texts.sort((a, b) => a.position.y - b.position.y);
}, [texts]);
```

**実装期間**: 2-3時間

### 2.2 型安全性の基本改善

```typescript
// 最低限の型定義追加
type ActionResult<T = any> = 
  | { success: true; data: T }
  | { success: false; error: string };

// Server Actionsに適用
export async function deleteFileAction(
  fileId: string
): Promise<ActionResult> {
  // 実装
}
```

**実装期間**: 1-2時間

---

## 3. セキュリティ（Server Actions継続）

### 3.1 Server Actionsのセキュリティ強化

```typescript
// Server Action内で完結した検証
export async function updateProfileAction(formData: FormData) {
  'use server';
  
  // 1. 認証チェック
  const session = await getServerSession();
  if (!session) {
    return { error: 'Unauthorized' };
  }
  
  // 2. 入力検証（Zodは使わずシンプルに）
  const displayName = formData.get('displayName')?.toString();
  if (!displayName || displayName.length > 100) {
    return { error: '表示名は100文字以内で入力してください' };
  }
  
  // 3. SQLインジェクション対策（Prisma/Supabaseが自動対応）
  // 4. CSRF対策（Server Actionsが自動対応）
  
  // 処理実行
}
```

### 3.2 middleware.tsでの基本認証（既存を活用）

```typescript
// middleware.ts（既存のものを活用）
export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  
  const protectedPaths = ['/dashboard', '/profile', '/preview'];
  const isProtected = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );
  
  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

---

## 4. 実装不要な項目（MVPでは過剰）

### ❌ 以下は実装しない

1. **状態管理ライブラリ**
   - 現状のuseStateで十分機能している
   - Zustand/Redux等は複雑性を増すだけ

2. **API Routes移行**
   - Server ActionsのCSRF保護を失う
   - FormDataからJSONへの変更は工数がかかる

3. **依存性注入**
   - テストはモックで十分対応可能
   - DIコンテナは過剰設計

4. **仮想スクロール**
   - 現状のファイル数では不要
   - 100件程度なら通常のレンダリングで問題なし

5. **包括的なアクセシビリティ**
   - 基本的なaria-labelのみで十分
   - WAI-ARIA完全準拠は後回し

---

## 5. 実装計画（現実的なスケジュール）

### Week 1（必須項目）
**月曜〜火曜**: エラーハンドリング統一
- Toastコンポーネント作成（3時間）
- 既存のalertをToastに置き換え（2時間）

**水曜〜木曜**: PreviewViewの分割
- 3つのコンポーネントに分割（1日）
- テスト実行・動作確認（2時間）

**金曜**: Server Actions改善
- FormData不要な実装に変更（3時間）
- 型定義の追加（2時間）

### Week 2（推奨項目）
**月曜**: パフォーマンス最適化
- React.memo適用（2時間）
- useMemo適用（1時間）

**火曜**: セキュリティ強化
- Server Action内の検証強化（3時間）
- middleware.ts調整（2時間）

**水曜〜金曜**: テスト・バグ修正
- E2Eテスト実行
- バグ修正
- デプロイ準備

---

## 6. 評価基準（MVP観点）

### 改善効果の測定指標

| 項目 | 現状 | 目標 | 優先度 |
|------|------|------|--------|
| エラー表示の一貫性 | alert混在 | Toast統一 | 高 |
| コンポーネントの行数 | 839行 | 最大300行 | 高 |
| 型カバレッジ | 60% | 80% | 中 |
| パフォーマンス（LCP） | 2.5秒 | 2.0秒 | 低 |
| セキュリティスコア | B | A | 高 |

---

## 7. リスクと対策

### リスク評価

| リスク | 可能性 | 影響度 | 対策 |
|--------|--------|--------|------|
| Server Actions変更による不具合 | 低 | 高 | 十分なテスト実施 |
| コンポーネント分割の複雑化 | 中 | 中 | 最小限の分割に留める |
| スケジュール遅延 | 低 | 中 | バッファ期間確保 |

---

## まとめ

### MVP向けの現実的な改善ポイント

1. **Server Actionsを維持** - CSRFセキュリティを保持
2. **最小限のリファクタリング** - 3つのコンポーネント分割
3. **シンプルなエラーハンドリング** - Toastコンポーネントのみ
4. **基本的な最適化** - React.memoの選択的適用
5. **必要十分なセキュリティ** - Server Actions内での検証

### 実装しない項目（コスト対効果が低い）

- ❌ API Routes移行
- ❌ 状態管理ライブラリ
- ❌ 依存性注入パターン
- ❌ 外部監視ツール
- ❌ 包括的なアクセシビリティ

### 総工数見積もり

- **必須項目**: 5営業日
- **推奨項目**: 3営業日
- **合計**: 8営業日（約2週間）

この計画により、MVPとして必要十分な品質を確保しながら、過剰な改善を避けることができます。
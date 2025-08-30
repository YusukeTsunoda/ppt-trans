# Server Actions 移行計画書

## 現在のアーキテクチャ分析

### 既存のAPI Routes (9個)
1. `/api/auth/callback` - Supabase認証コールバック
2. `/api/translate` - テキスト翻訳
3. `/api/translate-pptx` - PPTXファイル翻訳 
4. `/api/extract` - PPTXからテキスト抽出
5. `/api/apply-translations` - 翻訳結果の適用
6. `/api/health` - ヘルスチェック
7. `/api/health/auth` - 認証ヘルスチェック
8. `/api/health/db` - DBヘルスチェック
9. `/api/admin/activity` - 管理者用アクティビティ

### 既存のServer Actions (7個)
1. `auth.ts` - 認証関連（login, logout, signup, resetPassword）
2. `dashboard.ts` - ダッシュボード機能（getFiles, translateFileAction, deleteFileAction）
3. `upload.ts` - ファイルアップロード
4. `profile.ts` - プロフィール管理
5. `files.ts` - ファイル操作
6. `generation.ts` - 生成関連
7. `types.ts` - 型定義

## 移行が必要なAPI Routes

### 1. 翻訳関連API → Server Actions
#### `/api/translate/route.ts` → `actions/translate.ts`
```typescript
// 移行前（API Route）
export async function POST(request: NextRequest) {
  const { texts, targetLanguage } = await request.json();
  // 翻訳処理
}

// 移行後（Server Action）
'use server';
export async function translateTextsAction(texts: TextItem[], targetLanguage: string) {
  // 同じ翻訳処理をServer Actionとして実装
}
```

**必要な変更:**
- クライアントコンポーネントでのfetch呼び出しをServer Action呼び出しに変更
- エラーハンドリングの調整
- レスポンス形式の統一

#### `/api/extract/route.ts` → `actions/pptx.ts`
```typescript
// 移行後
'use server';
export async function extractTextFromPPTXAction(fileId: string, filePath: string) {
  // PPTXからテキスト抽出処理
}
```

#### `/api/apply-translations/route.ts` → `actions/pptx.ts`
```typescript
// 移行後
'use server';
export async function applyTranslationsAction(
  fileId: string,
  filePath: string,
  translations: TranslationData
) {
  // 翻訳適用処理
}
```

#### `/api/translate-pptx/route.ts` → `actions/pptx.ts`
```typescript
// 移行後
'use server';
export async function translatePPTXAction(fileId: string) {
  // PPTX全体の翻訳処理（extract → translate → apply の統合）
}
```

### 2. 管理者関連API → Server Actions
#### `/api/admin/activity/route.ts` → `actions/admin.ts`
```typescript
// 移行後
'use server';
export async function getAdminActivityAction() {
  // 管理者権限チェック
  // アクティビティデータ取得
}
```

### 3. 移行不要なAPI Routes（そのまま残す）
- `/api/auth/callback` - OAuth認証フローのため、API Routeが必要
- `/api/health/*` - 外部監視用エンドポイントのため、API Routeを維持

## 移行手順

### Phase 1: Server Actions作成（新規ファイル作成）
1. `src/app/actions/translate.ts` - テキスト翻訳Action
2. `src/app/actions/pptx.ts` - PPTX処理Actions（extract, apply, translate）
3. `src/app/actions/admin.ts` - 管理者機能Actions

### Phase 2: クライアントコンポーネント更新
1. **PreviewView** (`src/app/preview/[id]/page.tsx`)
   - fetch('/api/extract') → extractTextFromPPTXAction()
   - fetch('/api/translate') → translateTextsAction()
   - fetch('/api/apply-translations') → applyTranslationsAction()

2. **DashboardView** (`src/components/dashboard/DashboardView.tsx`)
   - translateFileAction内のfetch呼び出しを直接Server Action呼び出しに変更

3. **AdminPage** (`src/app/admin/page.tsx`)
   - fetch('/api/admin/activity') → getAdminActivityAction()

### Phase 3: 既存のServer Actions最適化
1. **dashboard.ts**の`translateFileAction`
   - API呼び出しを削除し、直接`translatePPTXAction`を呼び出す

```typescript
export async function translateFileAction(fileId: string) {
  'use server';
  // 認証チェック
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 直接Server Actionを呼び出し
  return await translatePPTXAction(fileId);
}
```

### Phase 4: テスト更新
1. E2Eテストの更新（API呼び出しをServer Action呼び出しに）
2. 単体テストの追加（新しいServer Actions用）

### Phase 5: API Routes削除
1. 動作確認後、不要になったAPI Routeファイルを削除
2. 関連するミドルウェアやユーティリティの整理

## 実装優先順位

1. **高優先度** - ユーザー向け主要機能
   - translateTextsAction（翻訳）
   - extractTextFromPPTXAction（抽出）
   - applyTranslationsAction（適用）

2. **中優先度** - 統合機能
   - translatePPTXAction（PPTX翻訳統合）
   - dashboard.tsの最適化

3. **低優先度** - 管理機能
   - getAdminActivityAction（管理者機能）

## 注意事項

1. **ファイル処理**
   - Server Actionsではファイルアップロードに制限があるため、大きなファイルは従来通りStorageを経由
   - 一時ファイルの処理は変更なし（/tmpディレクトリ使用）

2. **エラーハンドリング**
   - Server Actionsは例外をthrowせず、エラーオブジェクトを返す設計に
   - クライアント側でエラー表示の統一

3. **認証チェック**
   - 各Server Actionの冒頭で認証チェックを実施
   - 共通の認証ミドルウェア関数を作成して再利用

4. **Python連携**
   - spawn処理はServer Actions内でも動作するため、変更不要
   - タイムアウトやエラーハンドリングは既存ロジックを流用

## 移行のメリット

1. **パフォーマンス向上**
   - API呼び出しのオーバーヘッド削減
   - サーバーサイドでの直接実行

2. **型安全性**
   - TypeScriptの型推論が効く
   - エンドツーエンドの型安全性

3. **コード簡潔性**
   - fetchロジックの削除
   - エラーハンドリングの簡素化

4. **開発体験向上**
   - IDEのサポート（自動補完、リファクタリング）
   - デバッグの容易さ

## 段階的移行スケジュール案

- **Week 1**: Server Actions作成とテスト
- **Week 2**: クライアントコンポーネント更新
- **Week 3**: 統合テストと最適化
- **Week 4**: 本番環境デプロイと旧API削除
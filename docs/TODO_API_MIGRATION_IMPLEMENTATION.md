# API Routes移行実装 To-Doリスト

## 📅 実装スケジュール概要

| フェーズ | 期間 | 内容 | 優先度 |
|---------|------|------|--------|
| Phase 1 | Day 1 AM | セキュリティ基盤の実装 | 🔴 緊急 |
| Phase 2 | Day 1 PM | API Routes実装（認証系） | 🔴 緊急 |
| Phase 3 | Day 2 | コンポーネントの修正 | 🟡 重要 |
| Phase 4 | Day 3 | ファイルアップロード対応 | 🟡 重要 |
| Phase 5 | Day 4 | テストとクリーンアップ | 🟢 通常 |

---

## 🔧 Phase 1: セキュリティ基盤の実装（Day 1 AM）

### 1.1 CSRF保護実装 ✅ 最優先

#### 📁 `/src/lib/security/csrf.ts`
```typescript
// 新規作成
// 機能: CSRFトークンの生成と検証
// 依存: crypto, next/headers, next/server

実装内容:
- generateToken(): トークン生成
- verifyToken(): トークン検証
- secureCompare(): タイミング攻撃対策
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] CSRFProtectionクラス実装
- [ ] Double Submit Cookie Pattern実装
- [ ] テスト作成

#### 📁 `/src/lib/security/origin-validator.ts`
```typescript
// 新規作成
// 機能: Origin/Refererヘッダー検証
// 依存: next/server

実装内容:
- validate(): オリジン検証
- 環境変数からallowedOrigins設定
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] OriginValidatorクラス実装
- [ ] 環境変数設定追加

### 1.2 セッション管理実装

#### 📁 `/src/lib/security/session-manager.ts`
```typescript
// 新規作成
// 機能: JWTベースのセッション管理
// 依存: jose, next/headers, next/server

実装内容:
- createSession(): セッション作成
- verifySession(): セッション検証
- destroySession(): セッション破棄
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] SessionManagerクラス実装
- [ ] JWT設定
- [ ] Cookie設定（HTTPOnly, Secure, SameSite）

### 1.3 レート制限実装

#### 📁 `/src/lib/security/rate-limiter.ts`
```typescript
// 既存ファイル修正
// 追加機能: 高度なレート制限

実装内容:
- スライディングウィンドウ方式
- エンドポイント別設定
- クライアント識別の改善
```

**実装ステップ:**
- [ ] AdvancedRateLimiterクラス作成
- [ ] rateLimitConfigs定義
- [ ] ミドルウェアへの統合

### 1.4 入力検証スキーマ

#### 📁 `/src/lib/security/validators.ts`
```typescript
// 新規作成
// 機能: Zodスキーマ定義とサニタイゼーション
// 依存: zod, isomorphic-dompurify

実装内容:
- loginSchema
- signupSchema
- fileUploadSchema
- sanitizeInput()
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] 各種スキーマ定義
- [ ] サニタイゼーション関数実装

---

## 🚀 Phase 2: API Routes実装（Day 1 PM）

### 2.1 ログインAPI

#### 📁 `/app/api/auth/login/route.ts`
```typescript
// 既存ファイル修正
// セキュリティ強化版に更新

実装内容:
1. レート制限チェック
2. Origin/Referer検証
3. CSRF検証
4. 入力検証（Zod）
5. Supabase認証
6. セッション作成
7. 監査ログ
```

**実装ステップ:**
- [ ] セキュリティチェックの追加
- [ ] エラーハンドリング強化
- [ ] レスポンスヘッダー設定
- [ ] タイミング攻撃対策

### 2.2 サインアップAPI

#### 📁 `/app/api/auth/signup/route.ts`
```typescript
// 新規作成
// 機能: ユーザー登録

実装内容:
- パスワード強度検証
- メール重複チェック
- 確認メール送信
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] セキュリティチェック実装
- [ ] Supabase連携
- [ ] エラーハンドリング

### 2.3 ログアウトAPI

#### 📁 `/app/api/auth/logout/route.ts`
```typescript
// 新規作成
// 機能: セッション破棄

実装内容:
- セッショントークン無効化
- Cookie削除
- 監査ログ
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] セッション破棄処理
- [ ] Supabase signOut連携

### 2.4 パスワードリセットAPI

#### 📁 `/app/api/auth/forgot-password/route.ts`
```typescript
// 新規作成
// 機能: パスワードリセット

実装内容:
- メールアドレス検証
- リセットトークン生成
- メール送信
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] リセットフロー実装
- [ ] レート制限（厳格）

---

## 🎨 Phase 3: コンポーネントの修正（Day 2）

### 3.1 ログインフォーム統一

#### 📁 `/src/components/auth/LoginForm.tsx`
```typescript
// 既存ファイルを置き換え
// Server Actions → API Routes呼び出し

実装内容:
- useFormStateを削除
- fetch()によるAPI呼び出し
- CSRFトークン取得と送信
- エラーハンドリング
```

**実装ステップ:**
- [ ] 既存の複数バージョンを削除
  - [ ] LoginFormFixed.tsx 削除
  - [ ] LoginFormClient.tsx 削除
  - [ ] LoginFormStable.tsx → LoginForm.tsxにリネーム
- [ ] API呼び出し実装
- [ ] CSRFトークン処理追加
- [ ] ローディング状態管理

### 3.2 その他のフォーム修正

#### 📁 実装順序と依存関係
```
1. SignupForm.tsx
2. ForgotPasswordForm.tsx
3. UploadForm.tsx （Phase 4で実装）
```

**共通実装パターン:**
```typescript
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  // 1. CSRFトークン取得
  // 2. API呼び出し
  // 3. エラーハンドリング
  // 4. 成功時のリダイレクト
}
```

---

## 📤 Phase 4: ファイルアップロード対応（Day 3）

### 4.1 アップロードAPI

#### 📁 `/app/api/upload/route.ts`
```typescript
// 新規作成
// 機能: セキュアなファイルアップロード

実装内容:
- マルチパート処理
- ファイル検証（サイズ、タイプ、マジックバイト）
- ウイルススキャン（オプション）
- Supabase Storage連携
```

**実装ステップ:**
- [ ] ファイル作成
- [ ] SecureFileUploadクラス使用
- [ ] プログレストラッキング
- [ ] エラーハンドリング

### 4.2 ファイルセキュリティ

#### 📁 `/src/lib/security/file-upload.ts`
```typescript
// 新規作成
// 機能: ファイルアップロードセキュリティ

実装内容:
- ファイル検証
- サニタイゼーション
- 隔離ストレージ
```

---

## 🧪 Phase 5: テストとクリーンアップ（Day 4）

### 5.1 E2Eテスト修正

#### 📁 修正対象ファイル
```
e2e/
├── core/
│   ├── auth.spec.ts
│   └── upload.spec.ts
├── helpers/
│   └── api-helper.ts (新規)
└── page-objects/
    └── login.page.ts
```

**実装ステップ:**
- [ ] ApiHelperクラス作成
- [ ] 既存テストのServer Actions参照を削除
- [ ] API呼び出し監視に変更
- [ ] 全テスト実行と確認

### 5.2 クリーンアップ

#### 削除対象ファイル
```
src/app/actions/
├── auth-actions.ts ❌
├── upload-actions.ts ❌
├── signup-actions.ts ❌
└── forgot-password-actions.ts ❌

src/components/auth/
├── LoginFormFixed.tsx ❌
├── LoginFormClient.tsx ❌
├── SignupFormFixed.tsx ❌
└── ForgotPasswordFormFixed.tsx ❌
```

**実装ステップ:**
- [ ] Server Actionsファイル削除
- [ ] 重複コンポーネント削除
- [ ] 未使用インポート削除
- [ ] package.jsonの依存関係整理

---

## 📊 進捗管理

### デイリーチェックポイント

#### Day 1 完了条件
- [ ] すべてのセキュリティ基盤実装完了
- [ ] ログインAPIが動作
- [ ] CSRF保護が機能

#### Day 2 完了条件
- [ ] すべての認証APIが動作
- [ ] ログインフォームがAPI経由で動作
- [ ] セキュリティヘッダー設定完了

#### Day 3 完了条件
- [ ] アップロードAPIが動作
- [ ] すべてのフォームコンポーネント修正完了
- [ ] Server Actions依存の削除

#### Day 4 完了条件
- [ ] 全E2Eテストがパス
- [ ] 不要ファイルの削除完了
- [ ] ドキュメント更新完了

---

## ⚠️ 実装時の注意事項

1. **必ず既存のテストを実行してから変更を開始**
2. **各フェーズ完了時にコミット**
3. **本番環境変数の確認（SESSION_SECRET等）**
4. **ブランチ戦略：`feature/api-routes-migration`で作業**

---

## 🔍 トラブルシューティング

### よくある問題と解決方法

| 問題 | 原因 | 解決方法 |
|------|------|---------|
| CSRFエラー | トークン不一致 | Cookieの設定確認 |
| CORS エラー | Origin設定漏れ | 環境変数確認 |
| 認証失敗 | セッション管理 | Cookie設定確認 |
| レート制限 | 設定が厳しすぎ | 閾値調整 |

---

このTo-Doリストに従って、一つずつ確実に実装を進めてください。
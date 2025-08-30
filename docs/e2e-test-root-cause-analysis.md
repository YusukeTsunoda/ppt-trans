# E2Eテスト失敗の根本原因分析

## 🔍 根本原因の特定

### 認証アーキテクチャの構造
```
[LoginForm] 
    ↓ (Server Action)
[loginAction] 
    ↓ (Supabase Auth)
[supabase.auth.signInWithPassword]
    ↓ (Success Response)
[useEffect redirect]
```

### 問題点

1. **Supabase依存性**
   - テスト環境でSupabaseの認証が実際に動作していない
   - テストデータベースが存在しない、または接続できない
   
2. **Server Actionsのテスト制限**
   - PlaywrightはServer Actionsの完了を適切に待機できない
   - formActionの非同期処理がクライアント側のリダイレクトと同期しない

3. **環境変数の問題**
   - NEXT_PUBLIC_APP_URLが正しく設定されていない可能性
   - Supabaseの認証情報が欠落している可能性

## 🎯 解決アプローチ：関心の分離

### 原則
**「認証のテスト」と「認証済み機能のテスト」を分離する**

### 実装戦略

#### 1. 認証フローの独立テスト
```typescript
// e2e/auth/auth.spec.ts
test.describe('認証フロー', () => {
  test('実際のログイン機能', async ({ page }) => {
    // 実際のSupabase認証をテスト
    // ここでのみ実際の認証をテスト
  });
});
```

#### 2. その他のテストは認証をバイパス
```typescript
// 認証状態を事前設定
test.use({
  storageState: 'auth.json' // 事前認証済み状態
});
```

## 🔧 実装手順

### Step 1: 認証状態の永続化
認証成功後のセッション状態を保存し、他のテストで再利用

### Step 2: MSWの導入
Server Actionsをモック化し、Supabase依存を排除

### Step 3: 環境変数によるテストモード
テスト時のみ認証をバイパスする仕組みを構築
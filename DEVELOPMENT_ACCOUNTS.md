# 🔑 開発環境用テストアカウント

## ✅ 動作確認済みアカウント

### テストユーザー
```
📧 メールアドレス: test@example.com
🔐 パスワード: Test123
```

このアカウントは正常に作成され、ログイン可能です。

---

## 🚀 使い方

1. **開発サーバーの起動**
```bash
# Supabaseの起動（Docker必須）
supabase start

# 開発サーバーの起動（ポート3000）
PORT=3000 npm run dev
```

2. **ログイン**
- http://localhost:3000/login にアクセス
- 上記の認証情報でログイン

---

## 📝 新規ユーザーの作成

### 方法1: Webインターフェース経由
1. http://localhost:3000/register にアクセス
2. 新規アカウント情報を入力

### 方法2: Supabase Auth API経由
```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-email@example.com","password":"YourPassword123"}'
```

---

## 🔧 管理者権限の付与

管理者権限を付与するには、profilesテーブルのroleフィールドを更新します：

```sql
-- Supabase Studio（http://127.0.0.1:54323）で実行
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'test@example.com';
```

---

## ⚙️ システム構成

- **認証**: Supabase Auth
- **データベース**: PostgreSQL（Supabase内蔵）
- **プロフィール管理**: profilesテーブル（roleフィールドでuser/admin判定）
- **セッション管理**: JWT（Supabase Auth）

---

## ⚠️ 注意事項

1. **Dockerが必要**: Supabaseローカル環境はDockerで動作します
2. **ポート競合**: 3000番ポートが使用中の場合は別のポートを指定
3. **開発環境専用**: 本番環境では使用しないでください

---

更新日: 2025-01-23
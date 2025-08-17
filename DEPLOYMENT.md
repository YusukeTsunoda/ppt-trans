# PowerPoint Translator - デプロイメントガイド

## 📋 前提条件

- Vercelアカウント
- Supabaseプロジェクト（本番用）
- Anthropic API キー
- GitHub リポジトリ

## 🚀 デプロイ手順

### 1. Supabaseプロジェクトのセットアップ

1. [Supabase](https://supabase.com) で新しいプロジェクトを作成
2. データベースマイグレーションを実行：

```sql
-- プロファイルテーブル
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ファイル管理テーブル
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'completed', 'failed')),
  translation_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_created_at ON files(created_at DESC);

-- RLSを有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- RLSポリシー
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can view own files" ON files
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own files" ON files
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON files
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON files
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

3. Storage バケットを作成：
   - バケット名: `uploads`
   - Public: No
   - Allowed MIME types: `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint`

### 2. Vercelへのデプロイ

#### オプション A: GitHub連携（推奨）

1. コードをGitHubにプッシュ
2. [Vercel](https://vercel.com) にログイン
3. "New Project" をクリック
4. GitHubリポジトリをインポート
5. 環境変数を設定（下記参照）
6. "Deploy" をクリック

#### オプション B: Vercel CLI

```bash
# Vercel CLIをインストール
npm i -g vercel

# デプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

### 3. 環境変数の設定

Vercelダッシュボードで以下の環境変数を設定：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-api03-your-key
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 4. ドメイン設定（オプション）

1. Vercelダッシュボードで "Settings" → "Domains"
2. カスタムドメインを追加
3. DNSレコードを設定

## 🔧 トラブルシューティング

### ビルドエラー

```bash
# ローカルでビルドテスト
npm run build

# TypeScriptエラーチェック
npm run type-check

# Lintエラーチェック
npm run lint
```

### Pythonスクリプトエラー

Vercelはデフォルトでpython-pptxをサポートしていないため、以下の対応が必要：

1. **オプション1**: Python Layerを使用
2. **オプション2**: 別のマイクロサービスとして分離
3. **オプション3**: Edge Functionで処理

### データベース接続エラー

1. Supabase URLとキーが正しいか確認
2. RLSポリシーが適切に設定されているか確認
3. ネットワーク設定を確認

## 📊 モニタリング

### Vercel Analytics

```javascript
// app/layout.tsx に追加
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### エラー監視（Sentry）

```bash
npm install @sentry/nextjs

# Sentry設定ウィザード
npx @sentry/wizard@latest -i nextjs
```

## 🔐 セキュリティチェックリスト

- [ ] 環境変数が本番用に設定されている
- [ ] Supabase RLSが有効になっている
- [ ] APIキーが環境変数から読み込まれている
- [ ] CORSが適切に設定されている
- [ ] Rate limitingが有効になっている
- [ ] ファイルアップロードサイズ制限が設定されている
- [ ] HTTPSが有効になっている
- [ ] セキュリティヘッダーが設定されている

## 📝 メンテナンス

### データベースバックアップ

```bash
# Supabaseダッシュボードから
# Settings → Database → Backups
```

### ログ確認

```bash
# Vercel CLI
vercel logs

# Supabaseログ
# Dashboard → Logs
```

### パフォーマンス最適化

1. 画像最適化
2. コード分割
3. キャッシュ戦略
4. CDN設定

## 🔄 CI/CD

### GitHub Actions設定例

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## 📧 サポート

問題が発生した場合は、以下を確認してください：

1. [Vercel Documentation](https://vercel.com/docs)
2. [Supabase Documentation](https://supabase.com/docs)
3. [Next.js Documentation](https://nextjs.org/docs)

---

最終更新: 2025年8月
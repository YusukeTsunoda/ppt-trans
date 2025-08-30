# PowerPoint Translator 🌐

AIを活用してPowerPointプレゼンテーションを自動翻訳するWebアプリケーション

[![CI](https://github.com/yourusername/ppt-trans/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/ppt-trans/actions/workflows/ci.yml)
[![Deploy](https://github.com/yourusername/ppt-trans/actions/workflows/deploy.yml/badge.svg)](https://github.com/yourusername/ppt-trans/actions/workflows/deploy.yml)

## ✨ 機能

- 📤 **PowerPointファイルアップロード** - .pptx/.ppt形式対応（最大50MB）
- 🤖 **AI翻訳** - Anthropic Claude APIによる高品質翻訳
- 📊 **プレゼンテーション構造保持** - レイアウトを崩さず翻訳
- 👤 **ユーザー認証** - Supabase Authによるセキュアな認証
- 📁 **ファイル管理** - アップロード履歴と翻訳済みファイル管理
- ⚡ **リアルタイム処理** - 進捗状況のリアルタイム表示
- 🔒 **セキュリティ** - レート制限、CORS、CSP対応
- 📈 **モニタリング** - Sentry、Google Analytics統合

## 🚀 クイックスタート

  ✅ テストユーザー

  - Email: test@example.com
  - Password: testpassword123
  - Role: user
  - Status: ログイン成功確認済み

  ✅ 管理者ユーザー

  - Email: admin@example.com
  - Password: adminpassword123
  - Role: admin
  - Status: ログイン成功確認済み

### 前提条件

- Node.js 18以上
- Docker Desktop
- Python 3.9以上（python-pptx用）
- Supabase CLI

### セットアップ

1. **リポジトリをクローン**
```bash
git clone https://github.com/yourusername/ppt-trans.git
cd ppt-trans
```

2. **依存関係をインストール**
```bash
# Node.js依存関係
npm install

# Python依存関係（仮想環境推奨）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
pip install python-pptx
```

3. **環境変数を設定**
```bash
cp .env.local.example .env.local
# .env.localを編集して必要な値を設定
```

4. **Supabaseローカル環境を起動**
```bash
supabase start
```

5. **開発サーバー起動**
```bash
npm run dev
```

アプリケーションは http://localhost:3000 で利用可能です。

## 🛠️ 技術スタック

### フロントエンド
- **Next.js 15** - React フレームワーク（App Router）
- **TypeScript** - 型安全な開発
- **Tailwind CSS** - ユーティリティファーストCSS
- **shadcn/ui** - 再利用可能なUIコンポーネント

### バックエンド
- **Supabase** 
  - 認証（Auth）
  - データベース（PostgreSQL）
  - ファイルストレージ
  - リアルタイム機能
- **Anthropic Claude API** - AI翻訳エンジン
- **Python (python-pptx)** - PowerPoint処理

### DevOps & モニタリング
- **Vercel** - ホスティング、エッジ関数
- **GitHub Actions** - CI/CD
- **Sentry** - エラーモニタリング
- **Google Analytics** - 利用状況分析
- **Docker** - 開発環境の統一

## 📦 主要コマンド

```bash
# 開発
npm run dev              # 開発サーバー起動
npm run build            # プロダクションビルド
npm run start            # プロダクションサーバー起動

# コード品質
npm run type-check       # TypeScriptチェック
npm run lint             # ESLintチェック
npm run test             # テスト実行
npm run test:coverage    # カバレッジレポート

# データベース
npm run db:setup         # データベースセットアップ
npm run db:types         # 型定義生成

# その他
npm run validate         # 全チェック実行
npm run health:check     # ヘルスチェック
```

## 📁 プロジェクト構造

```
ppt-trans/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # APIエンドポイント
│   │   ├── (auth)/       # 認証関連ページ
│   │   └── dashboard/    # ダッシュボード
│   ├── components/       # Reactコンポーネント
│   ├── lib/              # ユーティリティ関数
│   │   ├── supabase/     # Supabase設定
│   │   ├── pptx/         # PowerPoint処理
│   │   └── errors/       # エラーハンドリング
│   └── types/            # TypeScript型定義
├── public/               # 静的ファイル
├── supabase/            # Supabase設定
│   └── migrations/      # DBマイグレーション
├── scripts/             # ビルド・セットアップスクリプト
├── .github/             # GitHub Actions
│   └── workflows/       # CI/CDワークフロー
└── tests/               # テストファイル
```

## 🔒 セキュリティ

- **認証**: Supabase Auth (JWT)
- **認可**: Row Level Security (RLS)
- **レート制限**: API呼び出し制限
  - 認証: 15分あたり10回
  - 翻訳: 1時間あたり50回
  - アップロード: 1時間あたり20ファイル
- **CSP**: Content Security Policy
- **CORS**: Cross-Origin Resource Sharing設定
- **暗号化**: HTTPS通信

## 🧪 テスト

```bash
# ユニットテスト
npm run test

# テストをウォッチモードで実行
npm run test:watch

# カバレッジレポート生成
npm run test:coverage

# CI環境でのテスト
npm run test:ci
```

## 🚢 デプロイ

### Vercelへのデプロイ

1. GitHubリポジトリをフォーク
2. Vercelでプロジェクト作成
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
4. デプロイ実行

詳細は[DEPLOYMENT.md](./DEPLOYMENT.md)を参照

## 📊 モニタリング

### エラー監視（Sentry）
```bash
# 環境変数に追加
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
```

### アクセス解析（Google Analytics）
```bash
# 環境変数に追加
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📝 API仕様

### 認証エンドポイント
- `POST /api/auth/login` - ユーザーログイン
- `POST /api/auth/logout` - ログアウト
- `POST /api/auth/register` - 新規登録
- `POST /api/auth/renew-session` - セッション更新

### ファイル操作
- `POST /api/upload` - ファイルアップロード
- `GET /api/files` - ファイル一覧取得
- `DELETE /api/files/:id` - ファイル削除
- `GET /api/files/:id/download` - ファイルダウンロード

### 翻訳
- `POST /api/translate-pptx` - PowerPoint翻訳実行
- `GET /api/translate/status/:id` - 翻訳ステータス確認

### ヘルスチェック
- `GET /api/health` - システムヘルスチェック

## 🐛 トラブルシューティング

### よくある問題

1. **Supabaseが起動しない**
   ```bash
   supabase stop --no-backup
   docker system prune -a
   supabase start
   ```

2. **Python依存関係エラー**
   ```bash
   deactivate
   rm -rf venv
   python3 -m venv venv
   source venv/bin/activate
   pip install python-pptx
   ```

3. **ビルドエラー**
   ```bash
   rm -rf .next node_modules
   npm install
   npm run build
   ```

## 📄 ライセンス

MIT License - 詳細は[LICENSE](./LICENSE)を参照

## 👥 開発者

- [@YusukeTsunoda](https://github.com/YusukeTsunoda)

## 🙏 謝辞

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Anthropic](https://www.anthropic.com/)
- [Vercel](https://vercel.com/)
- [shadcn/ui](https://ui.shadcn.com/)

---

Built with ❤️ using Next.js and Supabase
# 推奨開発コマンド

## 日常開発
```bash
npm run dev              # 開発サーバー起動（Turbopack使用）
npm run build            # プロダクションビルド（Prisma生成含む）
npm run lint             # ESLint実行（自動修正付き）
```

## データベース操作
```bash
npm run prisma:generate  # Prismaクライアント生成
npm run prisma:migrate   # マイグレーション実行
npm run prisma:studio    # Prisma Studio起動
npm run db:seed          # データベースシード実行
npm run db:setup         # データベース初期セットアップ
```

## 分析・最適化
```bash
npm run build:analyze    # バンドルサイズ分析
```

## macOS固有のコマンド
- `find`: ファイル検索
- `grep`: テキスト検索
- `ls`: ディレクトリ一覧
- `cd`: ディレクトリ移動

## 開発フロー
1. 機能変更時：Server Actionsの使用を優先
2. API Routesは認証関連のみ使用
3. コミット前：`npm run lint`実行
4. データベース変更時：`npm run prisma:migrate`実行
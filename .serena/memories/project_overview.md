# PPTXTranslator プロジェクト概要

## プロジェクトの目的
PowerPointファイルをアップロードして翻訳し、編集できるWebアプリケーション

## 技術スタック
- **フロントエンド**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **バックエンド**: Next.js App Router, Server Actions
- **データベース**: SQLite (Prisma ORM)
- **認証**: NextAuth.js
- **翻訳**: Anthropic Claude API
- **主要ライブラリ**: Prisma, NextAuth, Anthropic SDK, Zod

## プロジェクト構造
```
pptx-translator/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes (一部残存)
│   │   ├── admin/             # 管理画面
│   │   ├── login/             # ログインページ
│   │   ├── register/          # 登録ページ
│   │   └── profile/           # プロフィールページ
│   ├── server-actions/        # Server Actions (主要機能)
│   ├── components/            # Reactコンポーネント
│   ├── lib/                   # ユーティリティ
│   └── hooks/                 # Reactフック
├── prisma/                    # データベーススキーマ
├── docs/                      # ドキュメント
└── scripts/                   # 各種スクリプト
```

## 開発コマンド
- `npm run dev`: 開発サーバー起動
- `npm run build`: プロダクションビルド
- `npm run lint`: ESLint実行
- `npm run prisma:generate`: Prismaクライアント生成
- `npm run prisma:migrate`: マイグレーション実行
- `npm run db:seed`: データベースシード

## 現在の状況
- Server Actions導入済み（17個のアクション）
- API Routes一部残存（7個のルート）
- 混在状態のため整理が必要
# コーディング規約と標準

## TypeScript設定
- Target: ES2017
- Strict mode: 有効
- Path mapping: `@/*` → `./src/*`

## ESLint設定
- Next.js推奨設定使用
- TypeScript関連ルール
- 未使用変数の警告（`_`プレフィックスで無視）
- React Hooks依存配列の警告

## ファイル命名規則
- コンポーネント: PascalCase (例: `UserProfile.tsx`)
- Server Actions: kebab-case (例: `upload-file.ts`)
- ユーティリティ: camelCase (例: `authUtils.ts`)
- 定数: UPPER_SNAKE_CASE

## アーキテクチャパターン
- Server-First開発：Server Actionsを優先使用
- Type-Safe開発：Zodによるスキーマ検証
- エラーハンドリング：統一されたAppErrorクラス

## データベース設計
- Prismaスキーマファースト
- 適切なインデックス設定
- カスケード削除の適切な使用

## セキュリティ標準
- 認証：NextAuth.js
- CSRFプロテクション：Server Actions自動適用
- レート制限：API Routes個別実装
- パスワード：bcryptハッシュ化
# プロジェクト構造 - PPT Translation App

## 📁 必要なファイル一覧

### 🔧 設定ファイル（ルート）
- `.env` - 環境変数（API キー、データベース接続）
- `.env.build` - ビルド情報  
- `.gitignore` - Git 除外設定
- `docker-compose.yml` - Docker 設定
- `next.config.js` - Next.js 設定
- `package.json` - 依存関係管理
- `tailwind.config.js` - Tailwind CSS 設定
- `tsconfig.json` - TypeScript 設定
- `vercel.json` - Vercel デプロイ設定
- `playwright.config.ts` - E2E テスト設定
- `jest.config.js` - 単体テスト設定

### 📚 ドキュメント
#### 必須ドキュメント
- `README.md` - プロジェクト概要
- `LICENSE` - ライセンス情報
- `DEPLOYMENT.md` - デプロイ手順
- `DEPLOYMENT_GUIDE.md` - 詳細デプロイガイド
- `QUICK_START_GUIDE.md` - クイックスタート
- `SUPABASE_SETUP.md` - Supabase セットアップ
- `TEST_USERS.md` - テストユーザー情報

#### docs/ フォルダ（仕様書）
- `00_sequence.md` - シーケンス図
- `01_requirements_definition.md` - 要件定義
- `02_functional_requirements.md` - 機能要件
- `03_non_functional_requirements.md` - 非機能要件
- `04_detailed_specifications.md` - 詳細仕様
- `05_payment_and_language_specifications.md` - 決済・言語仕様
- `06_technical_updates_and_ui_specifications.md` - 技術更新・UI仕様
- `Design.md` - デザイン仕様
- `PPTX-Preview-Logic.md` - プレビューロジック

### 💻 ソースコード（src/）
#### app/ - Next.js App Router
- `layout.tsx` - ルートレイアウト
- `page.tsx` - ホームページ
- `globals.css` - グローバルスタイル
- **actions/** - Server Actions
- **api/** - API ルート
  - `health/` - ヘルスチェック
  - `translate-pptx/` - 翻訳API
- **各ページディレクトリ**
  - `dashboard/`, `login/`, `register/`, `upload/`, `files/`, `profile/`, `admin/`

#### components/ - UIコンポーネント
- 共通コンポーネント
- `auth/` - 認証関連
- `dashboard/` - ダッシュボード
- `upload/` - アップロード

#### lib/ - ユーティリティ
- `auth/` - 認証ロジック
- `supabase/` - Supabase クライアント
- `translation/` - 翻訳管理
- `errors/` - エラー処理
- `security/` - セキュリティ
- `pptx/` - PowerPoint処理（Python）

### 🐍 Python スクリプト
- `scripts/`
  - `translate_pptx.py` - PPTX翻訳
  - `process_pptx.py` - PPTX処理
  - `test-seed.ts` - テストデータ
  - `test-setup.sh` - テストセットアップ
- `python_backend/`
  - `generate_pptx.py` - PPTX生成
- `test/`
  - `create_test_pptx.py` - テストファイル作成
  - `test_translation.py` - 翻訳テスト

### 🧪 テスト
- `e2e/` - E2Eテスト
  - `auth.spec.ts` - 認証テスト
  - `file-upload.spec.ts` - アップロードテスト
  - `page-objects/` - Page Object Model
  - `test-files/` - テスト用PPTXファイル
  - `security/` - セキュリティテスト
  - `performance/` - パフォーマンステスト

### 🗄️ データベース
- `supabase/migrations/`
  - `001_initial_schema.sql` - 初期スキーマ
  - `002_create_profiles.sql` - プロファイル作成
  - `003_storage_bucket.sql` - ストレージ設定
  - `MIGRATION_GUIDE.md` - マイグレーションガイド

### 🚀 デプロイ
- `deploy/`
  - `canary-config.json` - カナリアデプロイ設定
- `docker/`
  - `postgres/init/01_init.sql` - DB初期化

## 🗑️ 削除済みファイル（不要）

### 削除した一時ファイル
- 検証レポート（CRITICAL_VERIFICATION_REPORT.md等）
- 実装計画（ULTIMATE_IMPLEMENTATION_PLAN.md等）
- TODOリスト（todolist.md）
- エラー修正サマリー
- テスト用ファイル（ルートのtest_*.pptx）
- バックアップファイル（*.backup）
- 開発DB（dev.db）
- 一時HTMLファイル（clear_session.html）
- 重複設定（next.config.ts）
- 古い移行ガイド
- 不要なセットアップスクリプト
- public/downloads/（一時ダウンロード）

## 📝 メンテナンス推奨事項

1. **定期的なクリーンアップ**
   - test-results/ フォルダ
   - playwright-report/ フォルダ
   - node_modules/（npm install で再生成可能）

2. **バージョン管理**
   - .env ファイルは含めない（.env.example を用意）
   - ビルド成果物は含めない（.next/、dist/）

3. **ドキュメント更新**
   - 新機能追加時は仕様書を更新
   - API変更時はドキュメントを更新

## ✅ 現在のプロジェクト状態

- **クリーンアップ完了**: 不要なファイルを削除
- **構造整理済み**: 必要なファイルのみ保持
- **ドキュメント整備**: 必要な文書を維持
- **マイグレーション統合**: 重複を解消
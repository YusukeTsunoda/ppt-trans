# Supabaseマイグレーションガイド

## 📊 マイグレーション整理結果

### ✅ 最適化されたマイグレーション構成

現在のマイグレーションファイル（3ファイル）:

1. **001_initial_schema.sql** - メインスキーマ（統合版）
2. **002_create_profiles.sql** - 既存ユーザーのプロファイル作成
3. **003_storage_bucket.sql** - Storageバケット設定

### 🔧 実施した修正内容

#### 1. テーブル定義の統合
- `files`テーブルの重複定義を統合
  - 旧: 001と005で別々に定義（カラム構造も異なる）
  - 新: 001に統合、必要なカラムをすべて含む

#### 2. filesテーブルの統合カラム構造
```sql
- id (UUID)
- user_id (UUID) 
- filename (TEXT)
- original_filename (TEXT)
- storage_path (TEXT) -- 旧file_path
- translated_path (TEXT)
- file_size (INTEGER)
- mime_type (TEXT)
- status (TEXT) -- pending/processing/completed/failed
- source_language (TEXT) -- デフォルト: auto
- target_language (TEXT) -- デフォルト: ja
- slide_count (INTEGER)
- text_count (INTEGER)
- translation_progress (DECIMAL)
- error_message (TEXT)
- metadata (JSONB)
- created_at/updated_at (TIMESTAMPTZ)
```

#### 3. user_settingsテーブルの更新
- `translation_model`のデフォルト値を最新モデルに更新
- `source_language`と`target_language`カラムを追加

#### 4. handle_new_user関数の改善
- 新規ユーザー作成時に自動的に:
  - プロファイル作成
  - ユーザー設定作成
  - 使用制限の初期化

#### 5. 削除されたファイル
- `004_storage_bucket.sql` → `003_storage_bucket.sql`に番号変更
- `005_create_files_table.sql` → 削除（001に統合）

### 📝 マイグレーション実行手順

#### 1. データベースリセット（開発環境）
```bash
# Supabaseローカル環境のリセット
supabase db reset

# または既存データベースをクリーンアップ
supabase db reset --local
```

#### 2. マイグレーション実行
```bash
# マイグレーションを順番に実行
supabase migration up

# または個別実行
supabase db push
```

#### 3. 確認コマンド
```bash
# マイグレーション状態確認
supabase migration list

# テーブル構造確認
supabase db dump --schema-only
```

### ⚠️ 注意事項

1. **本番環境への適用前に**:
   - 必ずバックアップを取得
   - ステージング環境でテスト

2. **既存データがある場合**:
   - データ移行スクリプトが必要
   - カラム名の変更に注意（file_path → storage_path等）

3. **RLSポリシー**:
   - すべてのテーブルでRLSが有効
   - 認証済みユーザーのみアクセス可能

### 🔄 ロールバック手順

問題が発生した場合:
```bash
# 最後のマイグレーションを取り消し
supabase migration down

# 特定のバージョンまで戻す
supabase migration down --to-version 001
```

### 📊 テーブル関係図

```
auth.users
    ↓
profiles (1:1)
    ├── user_settings (1:1)
    ├── files (1:N)
    │   └── translations (1:N)
    ├── activity_logs (1:N)
    └── usage_limits (1:1)

storage.objects (Storage API)
    └── uploads バケット
```

### ✅ 統合後の利点

1. **シンプルな構造**: 3つのマイグレーションファイルのみ
2. **一貫性**: filesテーブルの構造が統一
3. **保守性**: 重複定義がなく管理が容易
4. **拡張性**: 新機能追加時の基盤が整備済み
# Supabase セットアップガイド

## 1. Supabaseプロジェクトの設定

### 必要な設定
1. [Supabase Dashboard](https://app.supabase.com)にログイン
2. プロジェクトを選択（または新規作成）
3. 以下の環境変数を`.env`ファイルに設定：

```env
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 2. ストレージバケットの設定

### 自動作成
アプリケーションは初回実行時に自動的に`pptx-files`バケットを作成します。

### 手動作成（オプション）
Supabase Dashboardから手動で作成する場合：

1. **Storage** セクションに移動
2. **New bucket** をクリック
3. 以下の設定で作成：
   - **Name**: `pptx-files`
   - **Public bucket**: ✅ チェック
   - **File size limit**: 52428800 (50MB)
   - **Allowed MIME types**: 
     - `application/vnd.openxmlformats-officedocument.presentationml.presentation`
     - `image/png`
     - `image/jpeg`

## 3. バケットポリシーの設定

### RLS（Row Level Security）ポリシー
`pptx-files`バケットに以下のポリシーを設定：

```sql
-- 全ユーザーに読み取り許可
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'pptx-files');

-- 認証済みユーザーにアップロード許可（オプション）
CREATE POLICY "Authenticated users can upload" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'pptx-files');

-- 認証済みユーザーに削除許可（オプション）
CREATE POLICY "Authenticated users can delete own files" ON storage.objects 
FOR DELETE USING (bucket_id = 'pptx-files');
```

## 4. CORS設定

Supabase Dashboardで設定：

1. **Settings** → **API** に移動
2. **CORS Configuration** セクション
3. 以下を追加：
   - **Allowed Origins**: `http://localhost:3000` （開発環境）
   - **本番環境URL**: `https://your-domain.com`

## 5. トラブルシューティング

### エラー: "Unexpected end of JSON input"
**原因**: Supabase接続エラー
**解決策**: 
- 環境変数が正しく設定されているか確認
- Supabaseプロジェクトがアクティブか確認

### エラー: "Failed to upload original file"
**原因**: バケットが存在しない、または権限不足
**解決策**: 
- アプリを再起動（自動作成される）
- または手動でバケットを作成

### エラー: "storage bucket not found"
**原因**: バケット名の不一致
**解決策**: 
- バケット名が`pptx-files`であることを確認

## 6. ファイル構造

アップロードされるファイルの構造：
```
pptx-files/
├── uploads/          # オリジナルPPTXファイル
│   └── [uuid].pptx
├── images/           # 変換された画像
│   └── [uuid]/
│       ├── slide_1.png
│       ├── slide_2.png
│       └── ...
└── translated/       # 翻訳済みPPTXファイル
    └── translated_[uuid].pptx
```

## 7. 推奨設定

### ストレージ容量
- 無料プラン: 1GB
- 必要に応じてアップグレード

### セキュリティ
- 本番環境では認証を実装
- RLSポリシーを適切に設定
- APIキーを環境変数で管理

### パフォーマンス
- CDNを有効化（Supabase Dashboard → Settings → Storage）
- 画像の最適化を検討

## 8. 環境変数の例

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://f...w.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...

# Anthropic API設定
ANTHROPIC_API_KEY=sk-ant-api03-...

# モデル選択（haiku または sonnet）
ANTHROPIC_MODEL=haiku
```
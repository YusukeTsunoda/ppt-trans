-- Supabase Storage バケット設定用SQLスクリプト
-- このスクリプトをSupabaseのSQL Editorで実行してください

-- 既存のバケットを削除（必要に応じて）
-- DELETE FROM storage.buckets WHERE name = 'pptx-files';
-- DELETE FROM storage.buckets WHERE name = 'presentations';

-- pptx-files バケットの作成（画像プレビュー用）
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'pptx-files',
  'pptx-files',
  true,  -- 公開バケット
  false,
  52428800,  -- 50MB制限
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- presentations バケットの作成（PPTXファイル用）
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'presentations',
  'presentations',
  true,  -- 公開バケット
  false,
  104857600,  -- 100MB制限
  ARRAY[
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/octet-stream'
  ]::text[];

-- RLSポリシーの設定

-- pptx-files バケットのポリシー
-- 誰でも読み取り可能
CREATE POLICY "Public read access for pptx-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'pptx-files');

-- 認証済みユーザーはアップロード可能
CREATE POLICY "Authenticated users can upload to pptx-files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pptx-files' 
    AND auth.role() = 'authenticated'
  );

-- 認証済みユーザーは自分のファイルを更新可能
CREATE POLICY "Authenticated users can update own files in pptx-files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pptx-files' 
    AND auth.role() = 'authenticated'
  );

-- 認証済みユーザーは自分のファイルを削除可能
CREATE POLICY "Authenticated users can delete own files in pptx-files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pptx-files' 
    AND auth.role() = 'authenticated'
  );

-- presentations バケットのポリシー
-- 誰でも読み取り可能
CREATE POLICY "Public read access for presentations" ON storage.objects
  FOR SELECT USING (bucket_id = 'presentations');

-- 認証済みユーザーはアップロード可能
CREATE POLICY "Authenticated users can upload to presentations" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'presentations' 
    AND auth.role() = 'authenticated'
  );

-- 認証済みユーザーは自分のファイルを更新可能
CREATE POLICY "Authenticated users can update own files in presentations" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'presentations' 
    AND auth.role() = 'authenticated'
  );

-- 認証済みユーザーは自分のファイルを削除可能
CREATE POLICY "Authenticated users can delete own files in presentations" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'presentations' 
    AND auth.role() = 'authenticated'
  );

-- サービスロールアクセス用のポリシー（バックエンド処理用）
-- サービスロールは全ての操作が可能
CREATE POLICY "Service role full access to pptx-files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'pptx-files' 
    AND auth.role() = 'service_role'
  );

CREATE POLICY "Service role full access to presentations" ON storage.objects
  FOR ALL USING (
    bucket_id = 'presentations' 
    AND auth.role() = 'service_role'
  );
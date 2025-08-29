-- Storage バケットの作成
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('uploads', 'uploads', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'])
ON CONFLICT (id) DO NOTHING;

-- RLSポリシー: 認証済みユーザーは自分のファイルをアップロード可能
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLSポリシー: 認証済みユーザーは自分のファイルを閲覧可能
CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLSポリシー: 認証済みユーザーは自分のファイルを削除可能
CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
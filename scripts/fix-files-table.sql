-- filesテーブルのカラム名を修正
-- original_nameをoriginal_filenameに変更

-- 既存のカラム名を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'files' 
AND table_schema = 'public';

-- カラム名を変更（original_nameが存在する場合）
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' 
    AND column_name = 'original_name' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.files RENAME COLUMN original_name TO original_filename;
    RAISE NOTICE 'Column renamed from original_name to original_filename';
  ELSE
    RAISE NOTICE 'Column original_name not found or already renamed';
  END IF;
END $$;

-- file_pathをstorage_pathに変更（必要な場合）
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'files' 
    AND column_name = 'file_path' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.files RENAME COLUMN file_path TO storage_path;
    RAISE NOTICE 'Column renamed from file_path to storage_path';
  ELSE
    RAISE NOTICE 'Column file_path not found or already renamed';
  END IF;
END $$;

-- statusカラムにuploadedを追加
DO $$
BEGIN
  -- 既存の制約を削除
  ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_status_check;
  
  -- 新しい制約を追加（uploadedを含む）
  ALTER TABLE public.files ADD CONSTRAINT files_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'uploaded'));
    
  RAISE NOTICE 'Status constraint updated to include uploaded';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Status constraint update failed: %', SQLERRM;
END $$;

-- 変更後のテーブル構造を確認
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'files' 
AND table_schema = 'public'
ORDER BY ordinal_position;
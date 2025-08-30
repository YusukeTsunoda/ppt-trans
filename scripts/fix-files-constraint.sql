-- filesテーブルのstatus制約を修正
-- 'uploaded'を許可値に追加

-- 既存の制約を削除
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_status_check;

-- 新しい制約を追加（uploadedを含む）
ALTER TABLE public.files ADD CONSTRAINT files_status_check 
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'uploaded'));

-- 確認
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.files'::regclass 
AND contype = 'c';
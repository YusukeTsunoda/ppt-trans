import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserFiles } from '@/lib/data/files';
import FilesView from './FilesView';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function FilesPage() {
  const supabase = await createClient();
  
  // ユーザー認証の確認
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login?callbackUrl=/files');
  }
  
  // ファイル一覧を取得（通常の関数として）
  const files = await getUserFiles();
  
  return (
    <FilesView 
      userEmail={user.email || ''} 
      initialFiles={files} 
    />
  );
}
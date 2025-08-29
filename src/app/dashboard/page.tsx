import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFiles } from '@/app/actions/dashboard';
import DashboardView from '@/components/dashboard/DashboardView';
import AppLayout from '@/components/layout/AppLayout';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // ユーザー認証の確認
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // ファイル一覧を取得
  const { files, error } = await getFiles();
  
  if (error) {
    console.error('Error loading dashboard:', error);
  }
  
  return (
    <AppLayout>
      <DashboardView 
        userEmail={user.email || ''} 
        initialFiles={files}
      />
    </AppLayout>
  );
}
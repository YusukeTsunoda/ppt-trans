import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getFiles } from '@/app/actions/dashboard';
import dynamic from 'next/dynamic';
import logger from '@/lib/logger';

// DashboardViewを動的インポート
const DashboardView = dynamic(
  () => import('@/components/dashboard/DashboardView'),
  { 
    loading: () => <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  }
);

// 動的レンダリングを強制
export const revalidate = 0;

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
    logger.error('Error loading dashboard:', error);
  }
  
  return (
    <DashboardView 
      userEmail={user.email || ''} 
      initialFiles={files}
    />
  );
}
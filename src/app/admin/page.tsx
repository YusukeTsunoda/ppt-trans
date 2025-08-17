import { redirect } from 'next/navigation';
import { checkAdminRole, getAdminDashboardData } from '@/lib/data/admin';
import AdminDashboardClient from './AdminDashboardClient';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // 管理者権限の確認
  const isAdmin = await checkAdminRole();
  
  if (!isAdmin) {
    redirect('/dashboard');
  }
  
  // 管理者ダッシュボードのデータを取得
  const { stats, users, logs } = await getAdminDashboardData();
  
  return (
    <AdminDashboardClient
      initialStats={stats}
      initialUsers={users}
      initialActivities={logs}
    />
  );
}
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAdminUser } from '@/lib/server-actions/admin/auth';
import { getDashboardStats, getUserStats, getFileStats } from '@/lib/server-actions/admin/stats';
import AdminStatsClient from './AdminStatsClient';

async function AdminStatsServer() {
  const user = await getCurrentAdminUser();
  
  if (!user || user.role !== 'ADMIN') {
    redirect('/');
  }

  // 並列でデータを取得
  const [dashboardStats, userStats, fileStats] = await Promise.all([
    getDashboardStats(),
    getUserStats(),
    getFileStats(),
  ]);

  return (
    <AdminStatsClient
      initialDashboardStats={dashboardStats.success ? dashboardStats.data : null}
      initialUserStats={userStats.success ? userStats.data : null}
      initialFileStats={fileStats.success ? fileStats.data : null}
    />
  );
}

export default function AdminStatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    }>
      <AdminStatsServer />
    </Suspense>
  );
}
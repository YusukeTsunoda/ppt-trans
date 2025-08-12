import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server-actions/admin/auth';
import { getDashboardStats, getAuditLogs } from '@/server-actions/admin/stats';
import { getUsers } from '@/server-actions/admin/users';
import AdminDashboardClient from './AdminDashboardClient';

async function AdminDashboardServer() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== 'ADMIN') {
    redirect('/');
  }

  // 並列でデータを取得
  const [statsResult, usersResult, auditLogsResult] = await Promise.all([
    getDashboardStats(),
    getUsers({ limit: 10 }),
    getAuditLogs({ limit: 20 }),
  ]);

  return (
    <AdminDashboardClient
      initialStats={statsResult.success ? statsResult.data : null}
      initialUsers={usersResult.success ? (usersResult.data?.users || []) : []}
      initialActivities={auditLogsResult.success ? (auditLogsResult.data?.logs || []) : []}
    />
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    }>
      <AdminDashboardServer />
    </Suspense>
  );
}
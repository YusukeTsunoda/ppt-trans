import { redirect } from 'next/navigation';
import { checkAdminRole } from '@/lib/data/admin';
import { createClient } from '@/lib/supabase/server';
import AdminStatsClient from './AdminStatsClient';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

async function getDetailedStats() {
  const supabase = await createClient();
  
  // 詳細な統計情報を取得
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [
    totalUsersResult,
    weeklyUsersResult,
    monthlyUsersResult,
    totalFilesResult,
    weeklyFilesResult,
    monthlyFilesResult
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('profiles').select('id', { count: 'exact' })
      .gte('created_at', lastWeek.toISOString()),
    supabase.from('profiles').select('id', { count: 'exact' })
      .gte('created_at', lastMonth.toISOString()),
    supabase.from('files').select('id', { count: 'exact' }),
    supabase.from('files').select('id', { count: 'exact' })
      .gte('created_at', lastWeek.toISOString()),
    supabase.from('files').select('id', { count: 'exact' })
      .gte('created_at', lastMonth.toISOString())
  ]);
  
  // ファイルサイズの統計
  const { data: fileSizes } = await supabase
    .from('files')
    .select('file_size');
  
  const totalSize = fileSizes?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
  const averageSize = fileSizes?.length ? totalSize / fileSizes.length : 0;
  
  return {
    users: {
      total: totalUsersResult.count || 0,
      weekly: weeklyUsersResult.count || 0,
      monthly: monthlyUsersResult.count || 0,
      growth: {
        weekly: weeklyUsersResult.count || 0,
        monthly: monthlyUsersResult.count || 0
      }
    },
    files: {
      total: totalFilesResult.count || 0,
      weekly: weeklyFilesResult.count || 0,
      monthly: monthlyFilesResult.count || 0,
      totalSize: totalSize,
      averageSize: averageSize
    },
    translations: {
      total: 0,
      successful: 0,
      failed: 0,
      averageTime: 0
    }
  };
}

export default async function AdminStatsPage() {
  // 管理者権限の確認
  const isAdmin = await checkAdminRole();
  
  if (!isAdmin) {
    redirect('/dashboard');
  }
  
  // 詳細な統計情報を取得
  const stats = await getDetailedStats();
  
  return <AdminStatsClient initialStats={stats} />;
}
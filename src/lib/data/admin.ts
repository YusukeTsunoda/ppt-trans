import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalTranslations: number;
  activeUsers: number;
  storageUsed: number;
  activeSubscriptions: number;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  role?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  details?: any;
  created_at: string;
}

export async function getAdminDashboardData() {
  const supabase = await createClient();
  
  try {
    // 統計情報を取得
    const [usersResult, filesResult] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }),
      supabase.from('files').select('id', { count: 'exact' })
    ]);
    
    const stats: AdminStats = {
      totalUsers: usersResult.count || 0,
      totalFiles: filesResult.count || 0,
      totalTranslations: 0,
      activeUsers: 0,
      storageUsed: 0,
      activeSubscriptions: 0
    };
    
    // 最近のユーザー一覧を取得
    const { data: users } = await supabase
      .from('profiles')
      .select('id, email:id, created_at:created_at, role:role')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 監査ログを取得（存在する場合）
    const logs: AuditLog[] = [];
    
    return {
      stats,
      users: users || [],
      logs
    };
  } catch (error) {
    logger.error('Error fetching admin data:', error);
    return {
      stats: {
        totalUsers: 0,
        totalFiles: 0,
        totalTranslations: 0,
        activeUsers: 0,
        storageUsed: 0,
        activeSubscriptions: 0
      },
      users: [],
      logs: []
    };
  }
}

export async function checkAdminRole(): Promise<boolean> {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return false;
  }
  
  // プロフィールからロールを確認
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  return profile?.role === 'ADMIN';
}
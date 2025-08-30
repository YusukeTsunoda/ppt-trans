import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Suspense } from 'react';
import { DynamicAdminDashboard } from '@/lib/optimization/dynamic-components';

export const revalidate = 0;

// Admin dashboard loading skeleton
function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="py-2 px-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  
  // Check user authentication and role
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // Check if user is admin
  const { data: userData, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (roleError || !userData || userData.role !== 'admin') {
    redirect('/dashboard');
  }
  
  // Fetch data for admin dashboard
  const [statsResult, usersResult, activitiesResult] = await Promise.all([
    // Fetch basic stats
    supabase.rpc('get_admin_stats').then(r => r.data || {}),
    
    // Fetch users with file counts
    supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        role,
        created_at,
        last_sign_in_at
      `)
      .limit(50)
      .then(r => r.data || []),
    
    // Fetch recent activities
    supabase
      .from('activity_logs')
      .select(`
        id,
        user_id,
        action,
        details,
        created_at,
        users (email, name)
      `)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r.data || [])
  ]);

  // Transform the data for the client component
  const initialStats = {
    totalUsers: statsResult.total_users || 0,
    activeUsers: statsResult.active_users || 0,
    totalFiles: statsResult.total_files || 0,
    totalTranslations: statsResult.total_translations || 0,
    storageUsed: statsResult.storage_used || 0,
    activeSubscriptions: statsResult.active_subscriptions || 0,
  };

  const initialUsers = usersResult.map((user: any) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at,
    lastLoginAt: user.last_sign_in_at,
    isActive: user.last_sign_in_at ? 
      new Date(user.last_sign_in_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : 
      false,
    _count: {
      files: 0 // This would need a separate query or RPC call
    }
  }));

  const initialActivities = activitiesResult.map((activity: any) => ({
    id: activity.id,
    user_id: activity.user_id,
    action: activity.action,
    details: activity.details,
    created_at: activity.created_at,
    user: {
      email: activity.users?.email || 'Unknown',
      name: activity.users?.name
    }
  }));

  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <DynamicAdminDashboard
        initialStats={initialStats}
        initialUsers={initialUsers}
        initialActivities={initialActivities}
      />
    </Suspense>
  );
}

export async function generateMetadata() {
  return {
    title: '管理者ダッシュボード',
    description: 'システム全体の統計情報とユーザー管理を行います。',
    robots: 'noindex, nofollow' // Admin pages should not be indexed
  };
}
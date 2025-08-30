import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DynamicDashboardView } from '@/lib/optimization/dynamic-components';

export const revalidate = 0;

// Dashboard loading skeleton
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow border border-slate-200">
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>

        {/* Recent files skeleton */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-slate-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-1"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                  </div>
                  <div className="h-8 w-20 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // Fetch user's files and stats
  const [filesResult, statsResult] = await Promise.all([
    // Fetch user's recent files
    supabase
      .from('files')
      .select(`
        id,
        filename,
        original_name,
        file_size,
        status,
        created_at,
        extracted_data
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    
    // Fetch basic stats for the user
    supabase
      .from('files')
      .select('id, status, file_size')
      .eq('user_id', user.id)
  ]);

  const files = filesResult.data || [];
  const allFiles = statsResult.data || [];

  // Calculate stats
  const totalFiles = allFiles.length;
  const totalSize = allFiles.reduce((sum, file) => sum + (file.file_size || 0), 0);
  const processedFiles = allFiles.filter(f => f.status === 'completed' || f.status === 'processed').length;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DynamicDashboardView 
        userEmail={user.email || ''}
        initialFiles={files}
      />
    </Suspense>
  );
}

export async function generateMetadata() {
  return {
    title: 'ダッシュボード - PowerPoint翻訳ツール',
    description: 'アップロードしたファイルの管理と翻訳状況を確認できます。',
  };
}
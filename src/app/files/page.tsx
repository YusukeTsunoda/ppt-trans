import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DynamicFilesView } from '@/lib/optimization/dynamic-components';

export const revalidate = 0;

// Files page skeleton
function FilesPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-4 bg-slate-200 rounded w-32"></div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <div className="h-8 bg-slate-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-64"></div>
            </div>
            <div className="h-10 bg-blue-200 rounded w-32"></div>
          </div>
        </div>

        {/* Files list skeleton */}
        <div className="bg-white rounded-lg shadow border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          </div>
          <div className="divide-y divide-slate-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="h-12 w-12 bg-slate-200 rounded"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-slate-200 rounded w-1/3 mb-2"></div>
                      <div className="flex items-center space-x-4">
                        <div className="h-3 bg-slate-200 rounded w-20"></div>
                        <div className="h-3 bg-slate-200 rounded w-16"></div>
                        <div className="h-3 bg-slate-200 rounded w-24"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-6 bg-green-200 rounded-full w-16"></div>
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                    <div className="h-8 bg-slate-200 rounded w-8"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function FilesPage() {
  const supabase = await createClient();
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // Fetch user's files
  const { data: files, error: filesError } = await supabase
    .from('files')
    .select(`
      id,
      user_id,
      filename,
      original_filename,
      file_size,
      mime_type,
      storage_path,
      status,
      translation_result,
      created_at,
      updated_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const userFiles = files || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard"
              className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                ファイル管理
              </h1>
              <p className="text-slate-600">
                アップロードしたファイルの一覧と管理
              </p>
            </div>
            <Link
              href="/upload"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              新しいファイルをアップロード
            </Link>
          </div>
        </div>

        {/* Files list with loading boundary */}
        <Suspense fallback={<FilesPageSkeleton />}>
          <DynamicFilesView 
            userEmail={user.email || ''}
            initialFiles={userFiles}
          />
        </Suspense>

        {/* No files state */}
        {userFiles.length === 0 && (
          <div className="bg-white rounded-lg shadow border border-slate-200 p-12 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">ファイルがありません</h3>
            <p className="text-slate-600 mb-6">
              まだファイルをアップロードしていません。最初のファイルをアップロードして翻訳を始めましょう。
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              ファイルをアップロード
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: 'ファイル管理 - PowerPoint翻訳ツール',
    description: 'アップロードしたPowerPointファイルの管理と状況確認ができます。',
  };
}
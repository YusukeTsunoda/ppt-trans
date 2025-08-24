import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// PreviewViewを動的インポート（1025行の巨大コンポーネント）
const PreviewView = dynamic(
  () => import('./PreviewView'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">プレビューを読み込み中...</p>
        </div>
      </div>
    )
  }
);

export const revalidate = 0;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PreviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  
  // ユーザー認証の確認
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // ファイル情報を取得
  const { data: file, error: fileError } = await supabase
    .from('files')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  
  if (fileError || !file) {
    redirect('/dashboard');
  }
  
  return <PreviewView file={file} />;
}
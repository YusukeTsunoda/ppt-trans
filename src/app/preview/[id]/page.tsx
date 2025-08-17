import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PreviewView from './PreviewView';

export const dynamic = 'force-dynamic';

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
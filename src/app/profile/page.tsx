import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/data/profile';
import ProfileClient from './ProfileClient';

// 動的レンダリングを強制
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  
  // ユーザー認証の確認
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  // プロフィール情報を取得（通常の関数として）
  const profile = await getUserProfile(user.id);
  
  return (
    <ProfileClient 
      userId={user.id}
      userEmail={user.email || ''}
      initialProfile={profile}
    />
  );
}
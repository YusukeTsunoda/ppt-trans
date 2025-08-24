import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/data/profile';
import dynamic from 'next/dynamic';

// ProfileClientを動的インポート（490行のコンポーネント）
const ProfileClient = dynamic(
  () => import('./ProfileClient'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
);

// 動的レンダリングを強制
export const revalidate = 0;

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
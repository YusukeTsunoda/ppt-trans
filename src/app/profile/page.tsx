import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getProfile } from '@/lib/server-actions/profile/get';
import ProfileClient from './ProfileClient';

async function ProfileServer() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  // Server ActionはFormDataと初期状態を期待
  const formData = new FormData();
  const initialState = {
    success: false,
    message: '',
    timestamp: Date.now()
  };
  
  const profileResult = await getProfile(initialState, formData);
  
  if (!profileResult.success || !profileResult.data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">プロファイルの取得に失敗しました</div>
      </div>
    );
  }

  return <ProfileClient initialProfile={profileResult.data} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    }>
      <ProfileServer />
    </Suspense>
  );
}
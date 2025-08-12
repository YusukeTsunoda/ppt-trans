import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProfile } from '@/server-actions/profile/get';
import ProfileClient from './ProfileClient';

async function ProfileServer() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/login');
  }

  const profileResult = await getProfile();
  
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
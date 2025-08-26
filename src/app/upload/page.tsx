'use client';

import { UploadForm } from '@/components/upload/UploadForm';
import { useAuth } from '@/lib/auth/hooks';
import { redirect } from 'next/navigation';

export default function UploadPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ファイルアップロード</h1>
      <UploadForm />
    </div>
  );
}
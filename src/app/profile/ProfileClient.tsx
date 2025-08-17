'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { updateProfileAction } from '@/app/actions/profile';
import type { Profile } from '@/lib/data/profile';

function SubmitButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? '保存中...' : '保存'}
    </button>
  );
}

interface ProfileClientProps {
  userId: string;
  userEmail: string;
  initialProfile: Profile | null;
}

export default function ProfileClient({ userId, userEmail, initialProfile }: ProfileClientProps) {
  const [state, formAction] = useFormState(updateProfileAction, null);
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">プロフィール</h1>
              <p className="mt-1 text-sm text-gray-600">アカウント情報と設定</p>
            </div>
            <Link 
              href="/dashboard" 
              className="text-blue-600 hover:text-blue-700"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
        </div>

        {/* アカウント情報 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">アカウント情報</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">ユーザーID</label>
              <p className="text-gray-900">{userId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">メールアドレス</label>
              <p className="text-gray-900">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* プロフィール編集フォーム */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">プロフィール設定</h2>
          
          {state?.success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
              <p className="text-green-700 text-sm">{state.message}</p>
            </div>
          )}
          
          {state?.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700 text-sm">{state.error}</p>
            </div>
          )}
          
          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                表示名
              </label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                defaultValue={initialProfile?.display_name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="表示名を入力"
              />
            </div>
            
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                自己紹介
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                defaultValue={initialProfile?.bio || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="自己紹介を入力"
              />
            </div>
            
            <div className="flex justify-end">
              <SubmitButton />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
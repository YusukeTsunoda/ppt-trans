'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface ProfileClientProps {
  user: User;
}

export default function ProfileClient({ user }: ProfileClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const supabase = createClient();

  const handleUpdateProfile = async (formData: FormData) => {
    setIsLoading(true);
    setMessage('');

    try {
      const displayName = formData.get('displayName') as string;
      
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName }
      });

      if (error) throw error;
      
      setMessage('プロフィールが更新されました');
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage('更新に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">プロフィール</h1>
      
      <div className="card">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <p className="text-gray-600">{user.email}</p>
        </div>

        <form action={handleUpdateProfile}>
          <div className="mb-4">
            <label htmlFor="displayName" className="block text-sm font-medium mb-1">
              表示名
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              className="input w-full"
              defaultValue={user.user_metadata?.display_name || ''}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
          >
            {isLoading ? '更新中...' : '更新'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm ${message.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export default function ProfileClient() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    
    // Get current user
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          setName(user.user_metadata?.name || '');
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    getUser();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setUpdating(true);
    setMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        data: { name }
      });

      if (error) throw error;

      setMessage('プロフィールを更新しました');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('更新に失敗しました');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">プロフィール設定</h1>

        <div className="bg-card rounded-lg shadow-sm border p-6">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                value={user.email || ''}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-muted-foreground mb-2">
                名前
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="お名前を入力"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                ユーザーID
              </label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm font-mono text-muted-foreground">
                {user.id}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                作成日
              </label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                {new Date(user.created_at).toLocaleDateString('ja-JP')}
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-md text-sm ${
                message.includes('失敗') 
                  ? 'bg-destructive/10 text-destructive' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updating}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {updating ? '更新中...' : '更新する'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 bg-card rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">アカウント設定</h2>
          
          <div className="space-y-4">
            <button
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="w-full px-4 py-2 text-left text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
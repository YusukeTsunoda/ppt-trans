'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export function UserNav() {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('USER');
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (user) {
          // プロファイルからロールを取得
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          setUserRole(profile?.role || 'USER');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null);
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        setUserRole(profile?.role || 'USER');
      } else {
        setUserRole('USER');
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="h-8 w-8 rounded-full bg-secondary-200 animate-pulse"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/login"
          className="text-sm font-medium text-secondary-700 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white"
        >
          ログイン
        </Link>
        <Link
          href="/register"
          className="text-sm font-medium text-white bg-primary-600 px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          新規登録
        </Link>
      </div>
    );
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-3 text-sm font-medium text-secondary-700 hover:text-secondary-900 dark:text-secondary-300 dark:hover:text-white"
      >
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white">
            {user.email?.[0].toUpperCase()}
          </div>
          <span>{user.email}</span>
          <svg
            className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-secondary-800 ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-4 py-2 text-xs text-secondary-500 dark:text-secondary-400">
              {user.email}
            </div>
            
            {isAdmin && (
              <>
                <hr className="my-1 border-secondary-200 dark:border-secondary-700" />
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                  onClick={() => setDropdownOpen(false)}
                >
                  🛠️ 管理画面
                </Link>
                <Link
                  href="/admin/stats"
                  className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
                  onClick={() => setDropdownOpen(false)}
                >
                  📊 統計ダッシュボード
                </Link>
              </>
            )}
            
            <hr className="my-1 border-secondary-200 dark:border-secondary-700" />
            
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
              onClick={() => setDropdownOpen(false)}
            >
              👤 プロフィール
            </Link>
            
            <Link
              href="/files"
              className="block px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
              onClick={() => setDropdownOpen(false)}
            >
              📁 マイファイル
            </Link>
            
            <hr className="my-1 border-secondary-200 dark:border-secondary-700" />
            
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-secondary-700"
            >
              🚪 ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
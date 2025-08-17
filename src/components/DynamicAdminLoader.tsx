/**
 * 管理者機能の動的ロード用コンポーネント
 * 管理者のみが使用する機能を条件付きで読み込む
 */

'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import logger from '@/lib/logger';

// ローディング表示
const AdminLoadingSkeleton = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// 管理者ダッシュボードの動的インポート
const DynamicAdminDashboard = dynamic(
  () => import('@/components/AdminDashboard').then(mod => mod.default),
  {
    loading: () => <AdminLoadingSkeleton />,
    ssr: false, // 管理者機能はSSR不要
  }
);

// 管理者統計ページは動的インポートしない
// ページコンポーネントはNext.jsのルーティングで処理する

interface DynamicAdminLoaderProps {
  type: 'dashboard';
}

export function DynamicAdminLoader({ type }: DynamicAdminLoaderProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 現在のユーザーを取得
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // プロファイルからロールを取得
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          setIsAdmin(profile?.role === 'ADMIN');
        }
      } catch (error) {
        logger.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // プロファイルからロールを取得
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        setIsAdmin(profile?.role === 'ADMIN');
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 認証待ち
  if (loading) {
    return <AdminLoadingSkeleton />;
  }

  // 管理者でない場合
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            アクセス権限がありません
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            このページは管理者のみアクセス可能です
          </p>
        </div>
      </div>
    );
  }

  // 管理者ダッシュボードを動的にロード
  return <DynamicAdminDashboard />;
}

// 個別エクスポート
export { DynamicAdminDashboard };
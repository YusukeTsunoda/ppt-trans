'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface DetailedStats {
  totalUsers: number;
  activeUsers: number;
  totalFiles: number;
  totalTranslations: number;
  totalSlides: number;
  totalTexts: number;
  storageUsed: number;
  averageFilesPerUser: number;
  averageSlidesPerFile: number;
  mostActiveUsers: {
    id: string;
    username: string;
    email: string;
    fileCount: number;
    translationCount: number;
    totalSlides: number;
  }[];
  recentFiles: {
    id: string;
    fileName: string;
    username: string;
    createdAt: string;
    status: string;
    slideCount: number;
  }[];
  translationStats: {
    model: string;
    count: number;
    percentage: number;
  }[];
  languageStats: {
    language: string;
    count: number;
    percentage: number;
  }[];
  dailyActivity: {
    date: string;
    uploads: number;
    translations: number;
    downloads: number;
  }[];
}

export default function AdminStatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || ((session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUPER_ADMIN')) {
      router.push('/');
      return;
    }

    fetchDetailedStats();
  }, [session, status, router, timeRange]);

  const fetchDetailedStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/detailed-stats?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching detailed stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">データの取得に失敗しました</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">統計ダッシュボード</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              システム全体の詳細な統計情報
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              ← 管理画面に戻る
            </Link>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as 'week' | 'month' | 'year')}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
            >
              <option value="week">過去7日間</option>
              <option value="month">過去30日間</option>
              <option value="year">過去1年間</option>
            </select>
          </div>
        </div>

        {/* 主要統計 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  総ユーザー数
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {stats.totalUsers}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  アクティブ: {stats.activeUsers}
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  総ファイル数
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {stats.totalFiles}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  平均: {stats.averageFilesPerUser.toFixed(1)}/ユーザー
                </p>
              </div>
              <div className="text-4xl">📁</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  総翻訳数
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {stats.totalTranslations}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {stats.totalTexts} テキスト
                </p>
              </div>
              <div className="text-4xl">🌐</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  ストレージ使用量
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {formatBytes(stats.storageUsed)}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {stats.totalSlides} スライド
                </p>
              </div>
              <div className="text-4xl">💾</div>
            </div>
          </div>
        </div>

        {/* グラフとチャート */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 日別アクティビティ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">日別アクティビティ</h3>
            <div className="space-y-2">
              {stats.dailyActivity.map((day) => (
                <div key={day.date} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(day.date).toLocaleDateString('ja-JP')}
                  </span>
                  <div className="flex gap-4 text-sm">
                    <span className="text-blue-600">↑ {day.uploads}</span>
                    <span className="text-green-600">🌐 {day.translations}</span>
                    <span className="text-purple-600">↓ {day.downloads}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* モデル使用状況 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">AIモデル使用状況</h3>
            <div className="space-y-3">
              {stats.translationStats.map((model) => (
                <div key={model.model}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {model.model.replace('claude-3-', '').replace('-20240307', '')}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {model.count} ({model.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${model.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 言語統計 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">翻訳言語分布</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.languageStats.map((lang) => (
              <div key={lang.language} className="text-center">
                <div className="text-2xl font-semibold text-foreground">
                  {lang.percentage.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {lang.language}
                </div>
                <div className="text-xs text-gray-500">
                  {lang.count} 回
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* アクティブユーザーランキング */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* トップユーザー */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-foreground">最もアクティブなユーザー</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ファイル
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      翻訳
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      スライド
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.mostActiveUsers.map((user, index) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-foreground">
                            {index === 0 && '🥇 '}
                            {index === 1 && '🥈 '}
                            {index === 2 && '🥉 '}
                            {user.username}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.fileCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.translationCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {user.totalSlides}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 最近のファイル */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-foreground">最近のファイル</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ファイル名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      スライド
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {stats.recentFiles.map((file) => (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground truncate max-w-[200px]">
                          {file.fileName}
                        </div>
                        <div className="text-xs">
                          <span className={`px-2 inline-flex leading-5 font-semibold rounded-full ${
                            file.status === 'COMPLETED' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {file.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {file.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {file.slideCount || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(file.createdAt), { 
                          addSuffix: true, 
                          locale: ja 
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
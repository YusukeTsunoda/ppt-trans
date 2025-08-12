'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AdminDashboardClientProps {
  initialStats: any;
  initialUsers: any[];
  initialActivities: any[];
}

export default function AdminDashboardClient({
  initialStats,
  initialUsers,
  initialActivities
}: AdminDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'activities'>('stats');

  const getActionLabel = (action: string) => {
    const actionLabels: Record<string, string> = {
      LOGIN: 'ログイン',
      LOGOUT: 'ログアウト',
      FILE_UPLOAD: 'ファイルアップロード',
      FILE_DOWNLOAD: 'ファイルダウンロード',
      FILE_DELETE: 'ファイル削除',
      FILE_TRANSLATE: '翻訳実行',
      SETTINGS_UPDATE: '設定更新',
      USER_CREATE: 'ユーザー作成',
      USER_UPDATE: 'ユーザー更新',
      USER_DELETE: 'ユーザー削除',
    };
    return actionLabels[action] || action;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">管理者ダッシュボード</h1>
          <p className="mt-2 text-secondary-600 dark:text-secondary-400">
            システム全体の状況を監視・管理
          </p>
        </div>

        <div className="border-b border-secondary-200 dark:border-secondary-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              統計情報
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              ユーザー管理
            </button>
            <button
              onClick={() => setActiveTab('activities')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activities'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300'
              }`}
            >
              アクティビティログ
            </button>
          </nav>
        </div>

        {activeTab === 'stats' && initialStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6">
              <div className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
                総ユーザー数
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {initialStats.overview?.totalUsers || 0}
              </div>
              {initialStats.overview?.userGrowthRate !== undefined && (
                <div className={`text-sm mt-1 ${
                  initialStats.overview.userGrowthRate > 0 ? 'text-accent-600' : 'text-red-600'
                }`}>
                  {initialStats.overview.userGrowthRate > 0 ? '+' : ''}{initialStats.overview.userGrowthRate}%
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6">
              <div className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
                アクティブユーザー
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {initialStats.overview?.activeUsers || 0}
              </div>
            </div>
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6">
              <div className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
                総ファイル数
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {initialStats.files?.totalFiles || 0}
              </div>
              {initialStats.files?.fileGrowthRate !== undefined && (
                <div className={`text-sm mt-1 ${
                  initialStats.files.fileGrowthRate > 0 ? 'text-accent-600' : 'text-red-600'
                }`}>
                  {initialStats.files.fileGrowthRate > 0 ? '+' : ''}{initialStats.files.fileGrowthRate}%
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-secondary-800 rounded-lg shadow p-6">
              <div className="text-sm font-medium text-secondary-500 dark:text-secondary-400">
                総翻訳数
              </div>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {initialStats.usage?.totalTranslations || 0}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
              <thead className="bg-secondary-50 dark:bg-secondary-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    ユーザー
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    ロール
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    ファイル数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    最終ログイン
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-secondary-800 divide-y divide-secondary-200 dark:divide-secondary-700">
                {initialUsers.map((user: any) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {user.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-secondary-500 dark:text-secondary-400">
                          {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'ADMIN' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-secondary-100 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {user._count?.files || user._count?.translations || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-500 dark:text-secondary-400">
                      {user.lastLoginAt 
                        ? formatDistanceToNow(new Date(user.lastLoginAt), { 
                            addSuffix: true, 
                            locale: ja 
                          })
                        : '未ログイン'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive
                          ? 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {user.isActive ? 'アクティブ' : '無効'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'activities' && (
          <div className="bg-white dark:bg-secondary-800 rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-700">
              <h3 className="text-lg font-medium text-foreground">最近のアクティビティ</h3>
            </div>
            <ul className="divide-y divide-secondary-200 dark:divide-secondary-700">
              {initialActivities.map((activity: any) => (
                <li key={activity.id} className="px-4 py-3">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activity.user?.name || activity.user?.email || 'Unknown User'}
                      </p>
                      <p className="text-sm text-secondary-500 dark:text-secondary-400">
                        {getActionLabel(activity.action)} - {activity.targetType || 'N/A'}
                      </p>
                    </div>
                    <div className="text-sm text-secondary-500 dark:text-secondary-400">
                      {formatDistanceToNow(new Date(activity.createdAt), { 
                        addSuffix: true, 
                        locale: ja 
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
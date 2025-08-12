'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AdminStatsClientProps {
  initialDashboardStats: any;
  initialUserStats: any;
  initialFileStats: any;
}

export default function AdminStatsClient({
  initialDashboardStats,
  initialUserStats,
  initialFileStats
}: AdminStatsClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'files'>('overview');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">統計ダッシュボード</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              システム全体の詳細な統計情報
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            ← 管理画面に戻る
          </Link>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              概要
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              ユーザー統計
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'files'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              ファイル統計
            </button>
          </nav>
        </div>

        {activeTab === 'overview' && initialDashboardStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      総ユーザー数
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {initialDashboardStats.overview?.totalUsers || 0}
                    </p>
                    {initialDashboardStats.overview?.userGrowthRate !== undefined && (
                      <p className={`mt-1 text-sm ${
                        initialDashboardStats.overview.userGrowthRate > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {initialDashboardStats.overview.userGrowthRate > 0 ? '+' : ''}{initialDashboardStats.overview.userGrowthRate}%
                      </p>
                    )}
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      アクティブユーザー
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {initialDashboardStats.overview?.activeUsers || 0}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      新規: {initialDashboardStats.overview?.newUsers || 0}
                    </p>
                  </div>
                  <div className="text-4xl">✨</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      総ファイル数
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {initialDashboardStats.files?.totalFiles || 0}
                    </p>
                    {initialDashboardStats.files?.fileGrowthRate !== undefined && (
                      <p className={`mt-1 text-sm ${
                        initialDashboardStats.files.fileGrowthRate > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {initialDashboardStats.files.fileGrowthRate > 0 ? '+' : ''}{initialDashboardStats.files.fileGrowthRate}%
                      </p>
                    )}
                  </div>
                  <div className="text-4xl">📁</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      ストレージ使用量
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {formatBytes(initialDashboardStats.usage?.storageUsed || 0)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      API: {initialDashboardStats.usage?.apiUsage || 0} 回
                    </p>
                  </div>
                  <div className="text-4xl">💾</div>
                </div>
              </div>
            </div>

            {initialDashboardStats.period && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  期間: {new Date(initialDashboardStats.period.startDate).toLocaleDateString('ja-JP')} 
                  〜 {new Date(initialDashboardStats.period.endDate).toLocaleDateString('ja-JP')}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'users' && initialUserStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ロール別ユーザー数</h3>
                <div className="space-y-3">
                  {initialUserStats.byRole?.map((role: any) => (
                    <div key={role.role} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{role.role}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {role._count} ユーザー
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ステータス別ユーザー数</h3>
                <div className="space-y-3">
                  {initialUserStats.byStatus?.map((status: any) => (
                    <div key={status.isActive.toString()} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">
                        {status.isActive ? 'アクティブ' : '非アクティブ'}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {status._count} ユーザー
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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
                        ファイル数
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        監査ログ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {initialUserStats.topActiveUsers?.map((user: any, index: number) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-foreground">
                              {index === 0 && '🥇 '}
                              {index === 1 && '🥈 '}
                              {index === 2 && '🥉 '}
                              {user.name || 'Unknown'}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {user._count?.files || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {user._count?.auditLogs || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && initialFileStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ステータス別ファイル数</h3>
                <div className="space-y-3">
                  {initialFileStats.byStatus?.map((status: any) => (
                    <div key={status.status} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{status.status}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {status._count} ファイル
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">タイプ別ファイル数</h3>
                <div className="space-y-3">
                  {initialFileStats.byType?.map((type: any) => (
                    <div key={type.mimeType} className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground truncate">
                        {type.mimeType?.split('/').pop() || 'Unknown'}
                      </span>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {type._count} ({formatBytes(type._sum?.fileSize || 0)})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-foreground">最大ファイル</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        ファイル名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        サイズ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        ユーザー
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        ステータス
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {initialFileStats.largestFiles?.map((file: any) => (
                      <tr key={file.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {file.fileName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {formatBytes(file.fileSize)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {file.user?.name || file.user?.email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            file.status === 'COMPLETED' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {file.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
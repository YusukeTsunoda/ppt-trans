'use client';

import { useState } from 'react';
import Link from 'next/link';

interface AdminStatsClientProps {
  initialStats: {
    users: {
      total: number;
      weekly: number;
      monthly: number;
      growth: {
        weekly: number;
        monthly: number;
      };
    };
    files: {
      total: number;
      weekly: number;
      monthly: number;
      totalSize: number;
      averageSize: number;
    };
    translations: {
      total: number;
      successful: number;
      failed: number;
      averageTime: number;
    };
  };
}

export default function AdminStatsClient({ initialStats }: AdminStatsClientProps) {
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

        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      総ユーザー数
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {initialStats.users.total}
                    </p>
                    <p className="mt-1 text-sm text-green-600">
                      今週: +{initialStats.users.weekly}
                    </p>
                  </div>
                  <div className="text-4xl">👥</div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      今月の新規ユーザー
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">
                      {initialStats.users.monthly}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      今週: {initialStats.users.weekly}
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
                      {initialStats.files.total}
                    </p>
                    <p className="mt-1 text-sm text-green-600">
                      今週: +{initialStats.files.weekly}
                    </p>
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
                      {formatBytes(initialStats.files.totalSize)}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      平均: {formatBytes(initialStats.files.averageSize)}
                    </p>
                  </div>
                  <div className="text-4xl">💾</div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                翻訳統計: 合計 {initialStats.translations.total} 件 | 
                成功 {initialStats.translations.successful} 件 | 
                失敗 {initialStats.translations.failed} 件
              </p>
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ユーザー統計</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">総ユーザー数</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.users.total}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">今週の新規</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.users.weekly}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">今月の新規</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.users.monthly}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">成長率</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">週間成長</span>
                    <span className="text-sm text-green-600">
                      +{initialStats.users.growth.weekly} ユーザー
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">月間成長</span>
                    <span className="text-sm text-green-600">
                      +{initialStats.users.growth.monthly} ユーザー
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">アクティビティ</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">アクティブ率</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.users.monthly > 0 
                        ? Math.round((initialStats.users.weekly / initialStats.users.monthly) * 100) 
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ファイル統計</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">総ファイル数</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.files.total}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">今週のアップロード</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.files.weekly}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">今月のアップロード</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.files.monthly}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">ストレージ</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">総使用量</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatBytes(initialStats.files.totalSize)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">平均サイズ</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatBytes(initialStats.files.averageSize)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">翻訳統計</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">総翻訳数</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.translations.total}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">成功率</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {initialStats.translations.total > 0
                        ? Math.round((initialStats.translations.successful / initialStats.translations.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
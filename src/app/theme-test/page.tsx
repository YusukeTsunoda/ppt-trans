'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ThemeTestPage() {
  const { theme, setTheme, resolvedTheme, systemTheme, themes } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          ダークモード診断ページ
        </h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            現在の設定
          </h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-400">現在のテーマ:</dt>
              <dd className="text-slate-900 dark:text-white">{theme || 'undefined'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-400">解決済みテーマ:</dt>
              <dd className="text-slate-900 dark:text-white">{resolvedTheme || 'undefined'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-400">システムテーマ:</dt>
              <dd className="text-slate-900 dark:text-white">{systemTheme || 'undefined'}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-400">利用可能なテーマ:</dt>
              <dd className="text-slate-900 dark:text-white">{themes.join(', ')}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600 dark:text-slate-400">HTMLクラス:</dt>
              <dd className="text-slate-900 dark:text-white">
                {typeof document !== 'undefined' ? document.documentElement.className : 'SSR'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            テーマ切り替え
          </h2>
          <div className="flex gap-4 items-center">
            <ThemeToggle />
            <button
              onClick={() => setTheme('light')}
              className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200"
            >
              ライトモード
            </button>
            <button
              onClick={() => setTheme('dark')}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
              ダークモード
            </button>
            <button
              onClick={() => setTheme('system')}
              className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
            >
              システム設定
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
            カラーテスト
          </h2>
          <div className="space-y-2">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
              青色のテストボックス
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded">
              グレーのテストボックス
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
              緑色のテストボックス
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
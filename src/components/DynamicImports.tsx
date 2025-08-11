import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

// 遅延読み込みするコンポーネントの定義
// EditorScreenは重いので遅延読み込み
export const DynamicEditorScreen = dynamic(
  () => import('@/components/EditorScreen').then(mod => mod.EditorScreen),
  {
    loading: () => <EditorScreenSkeleton />,
    ssr: false, // サーバーサイドレンダリングを無効化
  }
);

// PreviewScreenも遅延読み込み
export const DynamicPreviewScreen = dynamic(
  () => import('@/components/PreviewScreen').then(mod => mod.PreviewScreen),
  {
    loading: () => <PreviewScreenSkeleton />,
    ssr: false,
  }
);

// SettingsScreenも遅延読み込み
export const DynamicSettingsScreen = dynamic(
  () => import('@/components/SettingsScreen').then(mod => mod.SettingsScreen),
  {
    loading: () => <SettingsScreenSkeleton />,
    ssr: false,
  }
);

// 管理者ダッシュボードの遅延読み込み
export const DynamicAdminDashboard = dynamic(
  () => import('@/components/AdminDashboard').then(mod => mod.default),
  {
    loading: () => <AdminDashboardSkeleton />,
    ssr: false,
  }
);

// チャートコンポーネントの遅延読み込み
export const DynamicChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart as ComponentType<any>),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  }
);

// エラー詳細モーダルの遅延読み込み
export const DynamicErrorDetailModal = dynamic(
  () => import('@/components/ErrorDetailModal').then(mod => mod.ErrorDetailModal),
  {
    loading: () => null,
    ssr: false,
  }
);

// Skeleton Components
function EditorScreenSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-pulse">
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mb-6">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="space-y-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewScreenSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-pulse">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm mb-4 p-5 border border-slate-200 dark:border-slate-700">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsScreenSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-pulse">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-8 border border-slate-200 dark:border-slate-700">
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-pulse">
      <div className="container mx-auto px-4 py-8">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
    </div>
  );
}
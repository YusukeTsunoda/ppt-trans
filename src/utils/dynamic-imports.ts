/**
 * 動的インポートユーティリティ
 * 
 * バンドルサイズを削減するための動的インポート設定
 * 初回ロードに必要ないコンポーネントを遅延ロードする
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import React from 'react';

// ローディングコンポーネント（dynamicのloading propに対応した形式）
const LoadingSpinner = () => {
  return React.createElement('div', 
    { className: "flex justify-center items-center p-4" },
    React.createElement('div', 
      { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" }
    )
  );
};

/**
 * Rechartsコンポーネントの動的インポート
 * グラフ系は初回表示には不要なので遅延ロード
 */
export const DynamicLineChart = dynamic(
  () => import('recharts').then(mod => mod.LineChart as ComponentType<any>),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
);

export const DynamicBarChart = dynamic(
  () => import('recharts').then(mod => mod.BarChart as ComponentType<any>),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
);

export const DynamicAreaChart = dynamic(
  () => import('recharts').then(mod => mod.AreaChart as ComponentType<any>),
  { 
    loading: LoadingSpinner,
    ssr: false 
  }
);

/**
 * 重いエディターコンポーネントの動的インポート例
 * 実際のエディターコンポーネントがある場合はここで設定
 */
// export const DynamicEditor = dynamic(
//   () => import('@/components/Editor'),
//   { 
//     loading: LoadingSpinner,
//     ssr: false 
//   }
// );

/**
 * モーダルコンポーネントの動的インポート
 * ユーザーアクション後に表示されるものは遅延ロード
 */
export const createDynamicModal = <P extends object>(
  importPath: () => Promise<{ default: ComponentType<P> }>
) => {
  return dynamic<P>(importPath, {
    loading: LoadingSpinner,
    ssr: false
  });
};

/**
 * 管理画面コンポーネントの動的インポート
 * 管理者のみが使う機能は遅延ロード
 */
export const createDynamicAdminComponent = <P extends object>(
  importPath: () => Promise<{ default: ComponentType<P> }>
) => {
  return dynamic<P>(importPath, {
    loading: LoadingSpinner,
    ssr: false
  });
};

/**
 * 大きなライブラリを使用するコンポーネントの動的インポート例
 */
export const loadHeavyLibrary = async () => {
  // 例: PDFライブラリなど重いライブラリを動的にインポート
  // const pdfLib = await import('pdf-lib');
  // return pdfLib;
};

/**
 * ユーティリティ関数：条件付き動的インポート
 */
export const conditionalImport = async <T>(
  condition: boolean,
  importFunc: () => Promise<T>
): Promise<T | null> => {
  if (condition) {
    return await importFunc();
  }
  return null;
};
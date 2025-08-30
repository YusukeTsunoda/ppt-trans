/**
 * 動的インポート戦略の実装
 * フロントエンドパフォーマンスとUXのバランスを考慮
 */

import React, { ComponentType, lazy, Suspense } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import logger from '@/lib/logger';

/**
 * デメリット1: 初期表示の遅延
 * 対策: プリロードとプリフェッチの実装
 */
export class DynamicImportManager {
  private static preloadedModules = new Map<string, Promise<any>>();
  
  /**
   * コンポーネントのプリロード
   * ユーザーがアクセスする可能性が高いコンポーネントを事前読み込み
   */
  static preload(importFn: () => Promise<any>, key: string): void {
    if (!this.preloadedModules.has(key)) {
      const promise = importFn();
      this.preloadedModules.set(key, promise);
      
      // エラーハンドリング
      promise.catch(error => {
        logger.error(`Failed to preload module ${key}:`, error);
        this.preloadedModules.delete(key);
      });
    }
  }
  
  /**
   * プリロード済みモジュールの取得
   */
  static getPreloaded(key: string): Promise<any> | undefined {
    return this.preloadedModules.get(key);
  }
  
  /**
   * ユーザーインタラクションベースのプリロード
   */
  static preloadOnHover(importFn: () => Promise<any>, key: string): {
    onMouseEnter: () => void;
    onTouchStart: () => void;
  } {
    return {
      onMouseEnter: () => this.preload(importFn, key),
      onTouchStart: () => this.preload(importFn, key),
    };
  }
  
  /**
   * ルートベースのプリロード戦略
   */
  static preloadByRoute(pathname: string): void {
    // ルートに基づいて関連コンポーネントをプリロード
    const preloadMap: Record<string, Array<() => void>> = {
      '/dashboard': [
        () => this.preload(() => import('@/components/dashboard/DashboardView'), 'DashboardView'),
      ],
      '/preview': [
        () => this.preload(() => import('@/components/preview/PreviewControls'), 'PreviewControls'),
        () => this.preload(() => import('@/components/preview/PreviewSlide'), 'PreviewSlide'),
      ],
      '/settings': [
        () => this.preload(() => import('@/components/SettingsScreen'), 'SettingsScreen'),
      ],
    };
    
    const preloaders = preloadMap[pathname] || [];
    preloaders.forEach(preloader => preloader());
  }
}

/**
 * デメリット2: ローディング状態の不一致
 * 対策: 統一されたローディングコンポーネント
 */
export const LoadingStates = {
  // スケルトンスクリーン
  Skeleton: ({ height = 200 }: { height?: number }) => (
    <div 
      className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg"
      style={{ height }}
      role="status"
      aria-label="Loading content"
    >
      <span className="sr-only">Loading...</span>
    </div>
  ),
  
  // スピナー
  Spinner: ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-8 w-8',
      lg: 'h-12 w-12',
    };
    
    return (
      <div className="flex items-center justify-center p-4">
        <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`} />
      </div>
    );
  },
  
  // プログレスバー
  Progress: ({ progress }: { progress: number }) => (
    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
      <div 
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  ),
};

/**
 * デメリット3: エラーハンドリングの複雑化
 * 対策: 統一されたエラーバウンダリ
 */
export interface DynamicImportErrorProps {
  error: Error;
  retry: () => void;
  componentName: string;
}

export const DynamicImportError: React.FC<DynamicImportErrorProps> = ({
  error,
  retry,
  componentName,
}) => {
  // ネットワークエラーの判定
  const isNetworkError = error.message.includes('fetch') || 
                        error.message.includes('network') ||
                        error.message.includes('Failed to fetch');
  
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 rounded-lg">
      <div className="text-red-600 dark:text-red-400 mb-4">
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {isNetworkError ? 'ネットワークエラー' : 'コンポーネントの読み込みエラー'}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {componentName}の読み込みに失敗しました
      </p>
      <button
        onClick={retry}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        再試行
      </button>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-xs text-gray-500">
          <summary>エラー詳細</summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
};

/**
 * デメリット4: SEOへの影響
 * 対策: 重要コンテンツのSSR維持
 */
export const createDynamicComponent = <T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    ssr?: boolean;
    loading?: ComponentType;
    error?: ComponentType<DynamicImportErrorProps>;
    preload?: boolean;
    chunkName?: string;
  } = {}
) => {
  const {
    ssr = false,
    loading = LoadingStates.Spinner,
    error = DynamicImportError,
    preload = false,
    chunkName = 'dynamic-component',
  } = options;
  
  // SSRが必要な場合は通常のインポートを使用
  if (ssr && typeof window === 'undefined') {
    return lazy(importFn);
  }
  
  // プリロードが有効な場合
  if (preload && typeof window !== 'undefined') {
    DynamicImportManager.preload(importFn, chunkName);
  }
  
  // webpackChunkNameを使用してチャンク名を指定
  const LazyComponent = lazy(() => 
    importFn().catch(err => {
      logger.error(`Failed to load component ${chunkName}:`, err);
      // フォールバックコンポーネントを返す
      return { 
        default: (() => React.createElement(error, { 
          error: err, 
          retry: () => window.location.reload(), 
          componentName: chunkName 
        })) as unknown as T 
      };
    })
  );
  
  return LazyComponent;
};

/**
 * デメリット5: メモリリーク
 * 対策: コンポーネントのクリーンアップ
 */
export class ComponentLifecycleManager {
  private static mountedComponents = new Set<string>();
  private static cleanupFunctions = new Map<string, () => void>();
  
  static register(componentId: string, cleanup?: () => void): void {
    this.mountedComponents.add(componentId);
    if (cleanup) {
      this.cleanupFunctions.set(componentId, cleanup);
    }
  }
  
  static unregister(componentId: string): void {
    const cleanup = this.cleanupFunctions.get(componentId);
    if (cleanup) {
      cleanup();
      this.cleanupFunctions.delete(componentId);
    }
    this.mountedComponents.delete(componentId);
  }
  
  static isActive(componentId: string): boolean {
    return this.mountedComponents.has(componentId);
  }
  
  static cleanup(): void {
    this.cleanupFunctions.forEach(cleanup => cleanup());
    this.cleanupFunctions.clear();
    this.mountedComponents.clear();
  }
}

/**
 * インターセクションオブザーバーを使用した遅延読み込み
 */
export const LazyLoadOnVisible: React.FC<{
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  fallback?: React.ReactNode;
}> = ({ children, threshold = 0.1, rootMargin = '50px', fallback }) => {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold,
    rootMargin,
  });
  
  return (
    <div ref={ref}>
      {isIntersecting ? children : (fallback || <LoadingStates.Skeleton />)}
    </div>
  );
};
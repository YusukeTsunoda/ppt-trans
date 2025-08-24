'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * コンポーネントのプリロード戦略
 * ユーザーが次にアクセスする可能性が高いコンポーネントを事前読み込み
 */

// プリロード可能なコンポーネントのマップ
const preloadMap: Record<string, () => Promise<any>> = {
  '/dashboard': async () => {
    // ダッシュボードから遷移する可能性が高いコンポーネント
    await Promise.all([
      import('@/app/preview/[id]/PreviewView'),
      import('@/app/files/FilesView'),
      import('@/app/profile/ProfileClient'),
    ].map(promise => promise.catch(() => null))); // エラーを無視
  },
  '/files': async () => {
    // ファイル一覧から遷移する可能性が高いコンポーネント
    await import('@/app/preview/[id]/PreviewView').catch(() => null);
  },
  '/profile': async () => {
    // プロフィールから遷移する可能性が高いコンポーネント
    await import('@/components/dashboard/DashboardView').catch(() => null);
  },
};

/**
 * プリロードフック
 */
export function usePreload() {
  const pathname = usePathname();

  useEffect(() => {
    // 現在のパスに基づいてプリロード
    const preloader = preloadMap[pathname];
    if (preloader) {
      // 少し遅延させてメインコンテンツの読み込みを優先
      const timer = setTimeout(() => {
        preloader();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [pathname]);
}

/**
 * リンクホバー時のプリロード
 */
export function useHoverPreload(href: string) {
  const handleMouseEnter = () => {
    // プレビューページの場合
    if (href.includes('/preview/')) {
      import('@/app/preview/[id]/PreviewView').catch(() => null);
    }
    // ダッシュボードの場合
    else if (href === '/dashboard') {
      import('@/components/dashboard/DashboardView').catch(() => null);
    }
    // ファイル一覧の場合
    else if (href === '/files') {
      import('@/app/files/FilesView').catch(() => null);
    }
    // プロフィールの場合
    else if (href === '/profile') {
      import('@/app/profile/ProfileClient').catch(() => null);
    }
  };

  return {
    onMouseEnter: handleMouseEnter,
    onTouchStart: handleMouseEnter, // モバイル対応
  };
}

/**
 * IntersectionObserverを使用した可視範囲でのプリロード
 */
export function useVisibilityPreload(componentName: string, threshold = 0.5) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // コンポーネントが見えたらプリロード
            switch (componentName) {
              case 'PreviewView':
                import('@/app/preview/[id]/PreviewView').catch(() => null);
                break;
              case 'DashboardView':
                import('@/components/dashboard/DashboardView').catch(() => null);
                break;
              case 'ProfileClient':
                import('@/app/profile/ProfileClient').catch(() => null);
                break;
            }
          }
        });
      },
      { threshold }
    );

    // ダミー要素を監視（実際の要素は呼び出し側で設定）
    const element = document.getElementById(`preload-trigger-${componentName}`);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [componentName, threshold]);
}
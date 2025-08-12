'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { UserNav } from '@/components/UserNav';
import { MobileNav } from '@/components/MobileNav';
import { useResponsive } from '@/hooks/useResponsive';

interface DashboardLayoutProps {
  children: ReactNode;
  currentPage?: 'upload' | 'preview' | 'editor' | 'settings' | 'files' | 'profile' | 'admin';
}

// Sidebarコンポーネントが期待する型に変換
function getSidebarPage(page: string): 'upload' | 'preview' | 'editor' | 'settings' {
  const validPages = ['upload', 'preview', 'editor', 'settings'];
  if (validPages.includes(page)) {
    return page as 'upload' | 'preview' | 'editor' | 'settings';
  }
  // filesやprofileなどは設定ページとして扱う
  return 'settings';
}

export function DashboardLayout({ children, currentPage = 'upload' }: DashboardLayoutProps) {
  const responsive = useResponsive();

  // Sidebarで使用するページタイプに変換
  const sidebarPage = getSidebarPage(currentPage);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* デスクトップサイドバー */}
      {responsive.isDesktop && (
        <Sidebar 
          currentPage={sidebarPage}
          onPageChange={() => {}}
          hasData={true}
        />
      )}
      
      {/* メインコンテンツ */}
      <div className="flex-1 overflow-auto">
        <div className="w-full">
          {/* ヘッダー */}
          <div className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                {/* モバイルナビゲーション */}
                {responsive.isMobile && (
                  <MobileNav />
                )}
                
                {/* デスクトップタイトル */}
                {!responsive.isMobile && (
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {getPageTitle(currentPage)}
                    </h1>
                  </div>
                )}
                
                {/* ユーザーナビゲーション */}
                <UserNav />
              </div>
            </div>
          </div>
          
          {/* ページコンテンツ */}
          <div className="container mx-auto px-4 py-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function getPageTitle(page?: string): string {
  const titles: Record<string, string> = {
    upload: 'ファイルアップロード',
    preview: 'プレビュー',
    editor: 'エディター',
    settings: '設定',
    files: 'ファイル管理',
    profile: 'プロフィール',
    admin: '管理画面',
  };
  return titles[page || 'upload'] || 'PowerPoint 翻訳ツール';
}
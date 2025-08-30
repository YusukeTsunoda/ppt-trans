'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string; // Design.mdに準拠したアイコン文字
  badge?: number;
}

export default function AppNavigation({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'ダッシュボード', icon: '🏠' },
    { href: '/upload', label: 'アップロード', icon: '📤' },
    { href: '/files', label: 'ファイル管理', icon: '📁' },
    { href: '/profile', label: 'プロフィール', icon: '👤' },
  ];

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* ロゴ・ブランド - Design.md準拠のカラー */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center transform transition-all duration-200 group-hover:scale-110">
                <span className="text-white text-xl">🌐</span>
              </div>
              <span className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-all duration-200">
                PPT Translator
              </span>
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg
                  transition-all duration-200 font-medium text-sm
                  ${pathname === item.href 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-700 hover:bg-slate-100 hover:text-blue-600'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-emerald-500 text-white rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* ユーザーメニュー */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 bg-slate-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-slate-700 font-medium">
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 
                       hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200
                       hover:shadow-sm"
            >
              <span>🚪</span>
              <span>ログアウト</span>
            </button>
          </div>

          {/* モバイルメニューボタン */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-all duration-200"
            >
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* モバイルメニュー - Design.md準拠のアニメーション */}
      <div className={`md:hidden bg-white border-t border-slate-200 transition-all duration-200 ${
        mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`
                flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200
                ${pathname === item.href 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-700 hover:bg-slate-50 hover:text-blue-600'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          <div className="border-t border-slate-200 pt-2 mt-2">
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">ログイン中:</p>
              <p className="text-sm text-slate-700 font-medium">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2 text-left 
                       text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
            >
              <span>🚪</span>
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
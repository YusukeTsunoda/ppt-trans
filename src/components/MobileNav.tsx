'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleSignOut = async () => {
    closeMenu();
    await signOut({ callbackUrl: '/login' });
  };

  const menuItems = [
    { href: '/', label: 'ホーム', icon: '🏠' },
    { href: '/files', label: 'ファイル管理', icon: '📁', requireAuth: true },
    { href: '/profile', label: 'プロフィール', icon: '👤', requireAuth: true },
    { href: '/admin', label: '管理者', icon: '⚙️', requireAdmin: true },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* ハンバーガーボタン */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 right-4 z-50 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-lg md:hidden"
        aria-label="メニューを開く"
      >
        <div className="w-6 h-5 relative flex flex-col justify-between">
          <span className={`block h-0.5 w-full bg-gray-800 dark:bg-gray-200 transform transition-all duration-300 ${
            isOpen ? 'rotate-45 translate-y-2' : ''
          }`} />
          <span className={`block h-0.5 w-full bg-gray-800 dark:bg-gray-200 transition-all duration-300 ${
            isOpen ? 'opacity-0' : ''
          }`} />
          <span className={`block h-0.5 w-full bg-gray-800 dark:bg-gray-200 transform transition-all duration-300 ${
            isOpen ? '-rotate-45 -translate-y-2' : ''
          }`} />
        </div>
      </button>

      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* スライドメニュー */}
      <div className={`
        fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-900 
        shadow-2xl z-40 transform transition-transform duration-300 ease-in-out md:hidden
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* ヘッダー */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                メニュー
              </h2>
              <button
                onClick={closeMenu}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="メニューを閉じる"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ユーザー情報 */}
            {session?.user && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {session.user.name?.[0] || session.user.email?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.user.name || session.user.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {session.user.role || 'ユーザー'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* メニューアイテム */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                // 認証が必要なアイテムの表示制御
                if (item.requireAuth && !session) return null;
                if (item.requireAdmin && session?.user?.role !== 'ADMIN') return null;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMenu}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                        ${isActive(item.href)
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                      {isActive(item.href) && (
                        <span className="ml-auto w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-full" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* テーマ切り替え */}
            <button
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
                closeMenu();
              }}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {theme === 'dark' ? 'ダークモード' : 'ライトモード'}
                </span>
              </span>
              <div className="w-12 h-6 bg-gray-300 dark:bg-gray-600 rounded-full relative">
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform
                  ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}
                `} />
              </div>
            </button>

            {/* ログイン/ログアウト */}
            {session ? (
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <span className="text-xl">🚪</span>
                <span className="font-medium">ログアウト</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={closeMenu}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className="text-xl">🔐</span>
                <span className="font-medium">ログイン</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
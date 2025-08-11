'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState } from 'react';

export function UserNav() {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-4">
        <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/login"
          className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          ログイン
        </Link>
        <Link
          href="/register"
          className="text-sm font-medium text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          新規登録
        </Link>
      </div>
    );
  }

  const isAdmin = (session.user as any).role === 'ADMIN' || (session.user as any).role === 'SUPER_ADMIN';

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-3 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
      >
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
            {session.user?.email?.[0].toUpperCase()}
          </div>
          <span>{session.user?.email}</span>
          <svg
            className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
              {session.user?.name || session.user?.email}
            </div>
            
            {isAdmin && (
              <>
                <hr className="my-1 border-gray-200 dark:border-gray-700" />
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setDropdownOpen(false)}
                >
                  🛠️ 管理画面
                </Link>
                <Link
                  href="/admin/stats"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  onClick={() => setDropdownOpen(false)}
                >
                  📊 統計ダッシュボード
                </Link>
              </>
            )}
            
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
            
            <Link
              href="/profile"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setDropdownOpen(false)}
            >
              👤 プロフィール
            </Link>
            
            <Link
              href="/files"
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setDropdownOpen(false)}
            >
              📁 マイファイル
            </Link>
            
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
            
            <button
              onClick={() => {
                setDropdownOpen(false);
                signOut();
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              🚪 ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Settings, Upload, LogOut } from 'lucide-react';
import logger from '@/lib/logger';

interface AppHeaderProps {
  userEmail: string;
  onUploadClick?: () => void;
  showUploadButton?: boolean;
}

export default function AppHeader({ userEmail, onUploadClick, showUploadButton = true }: AppHeaderProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminRole = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          
          setIsAdmin(profile?.role === 'admin');
        }
      } catch (error) {
        logger.error('Error checking admin role:', error);
      }
    };

    checkAdminRole();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div>
            <Link href="/dashboard">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                PowerPoint Translator
              </h1>
            </Link>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">ようこそ、{userEmail}さん</p>
          </div>
          <div className="flex items-center gap-2">
            {/* 管理画面ボタン（管理者のみ） */}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                title="管理画面"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">管理画面</span>
              </Link>
            )}
            
            {/* プロフィールボタン */}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-all duration-200 text-sm text-slate-700 dark:text-slate-200"
              title="プロフィール設定"
            >
              <div className="w-6 h-6 bg-gradient-to-br from-blue-600 to-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline">プロフィール</span>
            </Link>
            
            {/* 新規アップロードボタン（条件付き） */}
            {showUploadButton && (
              onUploadClick ? (
                <button
                  onClick={onUploadClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                  data-testid="new-upload-button"
                >
                  <Upload className="w-4 h-4" />
                  <span>新規アップロード</span>
                </button>
              ) : (
                <Link
                  href="/upload"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                >
                  <Upload className="w-4 h-4" />
                  <span>新規アップロード</span>
                </Link>
              )
            )}
            
            {/* ログアウトボタン */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-all duration-200 text-sm"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
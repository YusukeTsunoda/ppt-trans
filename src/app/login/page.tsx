'use client';

import LoginFormStable from '@/components/auth/LoginFormStable';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="max-w-md w-full space-y-8">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">
              ログイン
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              PowerPoint翻訳サービスへようこそ
            </p>
          </div>
          
          <LoginFormStable />
          
          <div className="mt-6 text-center">
            <span className="text-sm text-slate-600">
              アカウントをお持ちでない方は
            </span>
            <Link 
              href="/register" 
              className="ml-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors duration-200"
            >
              新規登録
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
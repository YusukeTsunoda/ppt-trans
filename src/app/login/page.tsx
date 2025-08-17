import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-center">
          <svg className="loading-spinner mx-auto mb-4 h-12 w-12" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </div>
      </div>
    }>
      <div className="min-h-screen gradient-bg flex items-center justify-center animate-fadeIn">
        <div className="max-w-md w-full">
          <div className="card">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-slate-900">PowerPoint Translator</h1>
              <p className="text-slate-600 mt-2">アカウントにログイン</p>
            </div>
            
            <LoginForm />
            
            <div className="mt-4 text-center">
              <span className="text-slate-600 text-sm">アカウントをお持ちでない場合は </span>
              <Link href="/register" className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
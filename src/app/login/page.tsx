'use client';

import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { Suspense } from 'react';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin mx-auto mb-4 h-12 w-12 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center animate-fadeIn p-4">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{t('backToHome')}</span>
          </Link>
          
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('welcomeBack')}</h1>
              <p className="text-slate-600 dark:text-slate-300 mt-3">{t('loginToContinue')}</p>
            </div>
            
            <LoginForm />
            
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <span className="text-slate-600 dark:text-slate-300">{t('noAccount')} </span>
                <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors">
                  {t('signUp')}
                </Link>
              </div>
              
              <div className="mt-4 text-center">
                <Link href="/forgot-password" className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {t('forgotPassword')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
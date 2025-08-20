'use client';

import SignupForm from '@/components/auth/SignupForm';
import Link from 'next/link';
import { Sparkles, ArrowLeft, CheckCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('createAccount')}</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-3">{t('startForFree')}</p>
          </div>
          
          {/* 特典リスト */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 mb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('unlimitedTranslation')}</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('multiLanguageSupport')}</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{t('fastAiTranslation')}</span>
              </div>
            </div>
          </div>
          
          <SignupForm />
          
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-700">
            <div className="text-center">
              <span className="text-slate-600 dark:text-slate-300">{t('alreadyHaveAccount')} </span>
              <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold transition-colors">
                {t('login')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
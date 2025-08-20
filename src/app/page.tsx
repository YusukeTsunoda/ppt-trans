'use client';

import Link from 'next/link';
import { FileText, Globe, Zap, Shield, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/useTranslation';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      {/* ヘッダー */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-sky-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('appName')}</h1>
            </div>
            <nav className="flex items-center gap-4">
              <LanguageToggle />
              <ThemeToggle />
              <Link href="/login" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 font-medium">
                {t('login')}
              </Link>
              <Link href="/register" className="bg-gradient-to-r from-blue-600 to-sky-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-blue-700 hover:to-sky-700 transition-all duration-200 shadow-md hover:shadow-lg">
                {t('register')}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-sky-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center animate-fadeIn">
            <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <CheckCircle className="w-4 h-4" />
              <span>{t('heroTag')}</span>
            </div>
            <h1 className="text-6xl sm:text-7xl font-extrabold text-slate-900 dark:text-white mb-6 leading-tight" data-testid="home-title">
              {t('heroTitle')}
              <span className="bg-gradient-to-r from-blue-600 to-sky-600 bg-clip-text text-transparent block sm:inline"> {t('heroHighlight')}</span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('heroDescription')}
            </p>
          
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link 
                href="/register" 
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-sky-700 transform hover:-translate-y-0.5 transition-all duration-200"
                data-testid="register-link"
              >
                {t('getStarted')}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/login" 
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-8 py-4 rounded-2xl text-lg font-semibold border-2 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200"
                data-testid="login-link"
              >
                {t('loginButton')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="bg-background-secondary dark:bg-slate-800 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">{t('whyChooseUs')}</h2>
            <p className="text-xl text-slate-600 dark:text-slate-300">{t('featuresSubtitle')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white dark:bg-slate-700 rounded-2xl p-8 text-center shadow-soft hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{t('layoutPreservation')}</h3>
              <p className="text-slate-600 dark:text-slate-300">
                {t('layoutDescription')}
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-700 rounded-2xl p-8 text-center shadow-soft hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="w-8 h-8 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{t('multiLanguage')}</h3>
              <p className="text-slate-600 dark:text-slate-300">
                {t('multiLanguageDescription')}
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-700 rounded-2xl p-8 text-center shadow-soft hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{t('fastProcessing')}</h3>
              <p className="text-slate-600 dark:text-slate-300">
                {t('fastProcessingDescription')}
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-700 rounded-2xl p-8 text-center shadow-soft hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
              <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">{t('secure')}</h3>
              <p className="text-slate-600 dark:text-slate-300">
                {t('secureDescription')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="bg-white dark:bg-slate-900 py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-sky-600 rounded-3xl p-12 shadow-xl">
            <h2 className="text-4xl font-bold text-white mb-6">{t('ctaTitle')}</h2>
            <p className="text-xl text-white/90 mb-8">
              {t('ctaDescription')}
            </p>
            <Link 
              href="/register" 
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-2xl text-lg font-semibold hover:bg-slate-50 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg"
            >
              {t('createAccount')}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
      
      {/* フッター */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-sky-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-semibold">{t('appName')}</span>
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
                {t('privacyPolicy')}
              </Link>
              <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                {t('termsOfService')}
              </Link>
              <Link href="/contact" className="text-slate-400 hover:text-white transition-colors">
                {t('contact')}
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-400">
            <p>{t('copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
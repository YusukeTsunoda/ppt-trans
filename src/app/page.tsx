'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
      }
    };
    checkAuth();
  }, []);

  if (isLoggedIn) {
    router.push('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ナビゲーションバー */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-heading font-bold text-blue-600">
                PowerPoint Translator
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-slate-700 hover:text-blue-600 font-medium transition-all duration-200"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                className="btn-primary"
              >
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="relative overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 relative">
            <div className="text-center animate-fadeIn">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold mb-4 sm:mb-6">
                PowerPointを
                <span className="text-emerald-400 block sm:inline"> 瞬時に翻訳</span>
              </h2>
              <p className="text-base sm:text-lg lg:text-xl text-blue-100 mb-6 sm:mb-8 max-w-2xl mx-auto font-body px-4">
                AI搭載の高精度翻訳で、プレゼンテーション資料を
                世界中の言語に簡単変換。レイアウトも保持します。
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4 px-4">
                <Link
                  href="/login"
                  className="bg-white text-blue-600 hover:bg-slate-50 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-heading font-bold text-base sm:text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  今すぐ始める
                </Link>
                <Link
                  href="#features"
                  className="bg-blue-500 text-white hover:bg-blue-400 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-heading font-bold text-base sm:text-lg transition-all duration-200"
                >
                  機能を見る
                </Link>
              </div>
            </div>
            
            {/* 装飾的な要素 */}
            <div className="absolute -bottom-10 -right-10 w-24 sm:w-32 lg:w-40 h-24 sm:h-32 lg:h-40 bg-blue-500 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute -top-10 -left-10 w-20 sm:w-24 lg:w-32 h-20 sm:h-24 lg:h-32 bg-emerald-500 rounded-full opacity-20 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* 機能紹介セクション */}
      <section id="features" className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-3 sm:mb-4">
              主な機能
            </h3>
            <p className="text-base sm:text-lg text-slate-600 font-body">
              プロフェッショナルな翻訳を簡単に
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* 機能カード1 */}
            <div className="card hover:shadow-lg transition-all duration-200 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-all duration-200">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  簡単アップロード
                </h4>
                <p className="text-slate-600 font-body">
                  ドラッグ&ドロップで簡単にPowerPointファイルをアップロード
                </p>
              </div>
            </div>

            {/* 機能カード2 */}
            <div className="card hover:shadow-lg transition-all duration-200 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-all duration-200">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                </div>
                <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  AI高精度翻訳
                </h4>
                <p className="text-slate-600 font-body">
                  Claude AIによる文脈を理解した自然な翻訳を実現
                </p>
              </div>
            </div>

            {/* 機能カード3 */}
            <div className="card hover:shadow-lg transition-all duration-200 group">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-slate-200 transition-all duration-200">
                  <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                  レイアウト保持
                </h4>
                <p className="text-slate-600 font-body">
                  元のスライドデザインとレイアウトを完全に保持したまま翻訳
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-3 sm:mb-4">
              簡単3ステップ
            </h3>
            <p className="text-base sm:text-lg text-slate-600 font-body">
              誰でも簡単に使える直感的な操作
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-4">1</div>
              <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                ファイルをアップロード
              </h4>
              <p className="text-slate-600 font-body">
                翻訳したいPowerPointファイルを選択
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-emerald-600 mb-4">2</div>
              <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                言語を選択
              </h4>
              <p className="text-slate-600 font-body">
                翻訳先の言語を選択して翻訳開始
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-600 mb-4">3</div>
              <h4 className="text-xl font-heading font-semibold text-slate-900 mb-2">
                ダウンロード
              </h4>
              <p className="text-slate-600 font-body">
                翻訳完了後、ファイルをダウンロード
              </p>
            </div>
          </div>

          <div className="text-center mt-8 sm:mt-12">
            <Link
              href="/register"
              className="btn-accent text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 inline-block"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="py-12 sm:py-16 lg:py-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h3 className="text-2xl sm:text-3xl font-heading font-bold mb-3 sm:mb-4">
            今すぐ始めませんか？
          </h3>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 mb-6 sm:mb-8 font-body">
            登録は無料。クレジットカード不要で今すぐお試しいただけます。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/register"
              className="bg-white text-blue-600 hover:bg-slate-50 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-heading font-bold text-base sm:text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              無料アカウント作成
            </Link>
            <Link
              href="/login"
              className="bg-blue-500 text-white hover:bg-blue-400 px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-heading font-bold text-base sm:text-lg transition-all duration-200"
            >
              ログイン
            </Link>
          </div>
        </div>
      </section>

      {/* フッター（開発環境情報） */}
      <footer className="bg-slate-900 text-slate-400 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h4 className="text-white font-heading font-semibold mb-3 sm:mb-4">
                PowerPoint Translator
              </h4>
              <p className="text-sm font-body">
                AI搭載の高精度PowerPoint翻訳サービス
              </p>
            </div>
            <div>
              <h4 className="text-white font-heading font-semibold mb-3 sm:mb-4">
                開発環境情報
              </h4>
              <div className="space-y-1 text-xs sm:text-sm font-code">
                <p>✅ Next.js 15.4.6: 動作中</p>
                <p>✅ React 19.1.0: 設定済み</p>
                <p>✅ TypeScript: 有効</p>
                <p>✅ Tailwind CSS: 有効</p>
                <p>✅ Supabase: 接続中</p>
                <p>✅ Claude AI: 統合済み</p>
              </div>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-800 text-center text-xs sm:text-sm">
            <p>&copy; 2025 PowerPoint Translator. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
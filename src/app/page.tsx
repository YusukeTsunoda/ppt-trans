'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen gradient-bg animate-fadeIn">
      {/* ナビゲーションバー */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">PPT Translator</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-slate-700 hover:text-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              >
                ログイン
              </Link>
              <Link
                href="/register"
                className="btn-primary text-sm inline-block"
              >
                無料で始める
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center animate-slideUp">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
            <span className="animate-pulse mr-2">🚀</span>
            AI搭載の高精度翻訳エンジン
          </div>
          <h2 className="text-5xl font-bold text-slate-900 mb-6">
            PowerPointプレゼンテーションを
            <br />
            <span className="text-primary bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              瞬時に多言語翻訳
            </span>
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            AIを活用した高精度な翻訳で、グローバルなプレゼンテーションを簡単に作成。
            レイアウトを保持したまま、わずか数分で翻訳が完了します。
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/register"
              className="btn-primary transform transition hover:scale-105 inline-block"
            >
              無料で試してみる
            </Link>
            <Link
              href="/login?demo=true"
              className="btn-outline transform transition hover:scale-105 inline-block"
            >
              デモを見る
            </Link>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="bg-white py-16 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">
            なぜPPT Translatorを選ぶのか？
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card-hover text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">高速処理</h4>
              <p className="text-slate-600">
                最新のAI技術により、大量のスライドも数分で翻訳完了
              </p>
            </div>
            <div className="card-hover text-center">
              <div className="bg-emerald-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">高精度</h4>
              <p className="text-slate-600">
                専門用語も正確に翻訳し、文脈を理解した自然な翻訳を提供
              </p>
            </div>
            <div className="card-hover text-center">
              <div className="bg-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">レイアウト保持</h4>
              <p className="text-slate-600">
                元のデザインとフォーマットを維持したまま翻訳
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="gradient-bg py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center text-slate-900 mb-12">
            簡単3ステップで翻訳完了
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                1
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">ファイルをアップロード</h4>
              <p className="text-slate-600">
                PowerPointファイル（.pptx）をドラッグ＆ドロップまたは選択してアップロード
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                2
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">言語を選択</h4>
              <p className="text-slate-600">
                翻訳先の言語を選択し、翻訳オプションを設定
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg">
                3
              </div>
              <h4 className="text-xl font-semibold text-slate-900 mb-2">ダウンロード</h4>
              <p className="text-slate-600">
                翻訳が完了したファイルをダウンロードして完了
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTAセクション */}
      <section className="header-gradient py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h3 className="text-3xl font-bold text-white mb-4">
            今すぐ始めましょう
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            無料アカウントを作成して、最初の翻訳を試してみてください
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/register"
              className="bg-white text-blue-600 hover:bg-slate-50 px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform transition hover:scale-105 inline-block"
            >
              無料アカウント作成
            </Link>
            <Link
              href="/login"
              className="bg-blue-800 text-white hover:bg-blue-900 px-8 py-4 rounded-lg text-lg font-semibold shadow-lg transform transition hover:scale-105 inline-block"
            >
              ログインはこちら
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-slate-900 text-white py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-lg font-semibold">PPT Translator</h4>
              <p className="text-slate-400 text-sm mt-1">
                © 2024 PPT Translator. All rights reserved.
              </p>
            </div>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
                利用規約
              </Link>
              <Link href="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
                プライバシーポリシー
              </Link>
              <Link href="/contact" className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
                お問い合わせ
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
import Link from 'next/link';
import { FileText, Globe, Zap, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">PPT Translator</h1>
            <nav className="flex items-center gap-4">
              <Link href="/login" className="text-slate-600 hover:text-slate-900 transition-colors duration-200">
                ログイン
              </Link>
              <Link href="/register" className="btn-primary">
                無料で始める
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center animate-fadeIn">
          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 mb-6" data-testid="home-title">
            PowerPoint翻訳を
            <span className="text-blue-600 block sm:inline"> 瞬時に実現</span>
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
            AI技術を活用して、プレゼンテーションを高品質に翻訳。
            レイアウトを保持したまま、多言語対応を実現します。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link 
              href="/register" 
              className="btn-primary text-lg px-8 py-3"
              data-testid="register-link"
            >
              無料で始める
            </Link>
            <Link 
              href="/login" 
              className="btn-secondary text-lg px-8 py-3"
              data-testid="login-link"
            >
              ログインする
            </Link>
          </div>
        </div>

        {/* 特徴セクション */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
          <div className="card text-center animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            <FileText className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">レイアウト保持</h3>
            <p className="text-slate-600 text-sm">
              元のデザインを維持したまま翻訳
            </p>
          </div>
          
          <div className="card text-center animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            <Globe className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">多言語対応</h3>
            <p className="text-slate-600 text-sm">
              日本語、英語、中国語、韓国語に対応
            </p>
          </div>
          
          <div className="card text-center animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <Zap className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">高速処理</h3>
            <p className="text-slate-600 text-sm">
              AIによる迅速な翻訳処理
            </p>
          </div>
          
          <div className="card text-center animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            <Shield className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">セキュア</h3>
            <p className="text-slate-600 text-sm">
              安全なファイル処理と保管
            </p>
          </div>
        </div>

        {/* ステータス表示 */}
        <div className="mt-20 max-w-md mx-auto">
          <div className="card bg-slate-50 animate-fadeIn">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">システムステータス</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-slate-600">Next.js: 動作中</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-slate-600">TypeScript: 設定済み</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-slate-600">Tailwind CSS: 有効</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
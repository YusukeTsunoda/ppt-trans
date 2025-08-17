import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center animate-fadeIn">
      <div className="max-w-md w-full text-center">
        <div className="card">
          <div className="mb-8">
            <h1 className="text-9xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">404</h1>
          </div>
        
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            ページが見つかりません
          </h2>
          
          <p className="text-slate-600 mb-8">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
        
          <div className="space-y-3">
            <Link
              href="/"
              className="btn-primary w-full block"
            >
              🏠 ホームに戻る
            </Link>
            
            <Link
              href="/dashboard"
              className="btn-secondary w-full block"
            >
              📈 ダッシュボードへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
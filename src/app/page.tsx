import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4" data-testid="home-title">
          PowerPoint Translator
        </h1>
        <p className="text-gray-600 mb-8">
          PowerPointファイルをAIで高品質に翻訳
        </p>
        
        <div className="space-x-4 mb-8">
          <Link 
            href="/login" 
            className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-block"
            data-testid="login-link"
          >
            ログイン
          </Link>
          <Link 
            href="/register" 
            className="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 inline-block"
            data-testid="register-link"
          >
            新規登録
          </Link>
        </div>
        
        <div className="mt-8 space-y-2 text-left bg-gray-100 p-4 rounded">
          <p>✅ Next.js: 動作中</p>
          <p>✅ TypeScript: 設定済み</p>
          <p>✅ Tailwind CSS: 有効</p>
        </div>
      </div>
    </div>
  );
}
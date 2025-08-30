import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadForm } from '@/components/upload/UploadForm';

export default async function UploadPage() {
  const supabase = await createClient();
  
  // 認証確認
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }
  
  return (
    <div className="min-h-screen gradient-bg animate-fadeIn">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">ファイルアップロード</h1>
            <a
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              ← ダッシュボードに戻る
            </a>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="card animate-slideUp">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">
              PowerPointファイルをアップロード
            </h2>
            <p className="text-slate-600">
              翻訳したいPowerPointファイル（.pptx）を選択してください
            </p>
          </div>

          <UploadForm />

          <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">アップロードの注意事項</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 対応形式: .pptx（PowerPoint 2007以降）</li>
              <li>• 最大ファイルサイズ: 50MB</li>
              <li>• アップロード後、自動的に処理が開始されます</li>
              <li>• 処理完了後、ダッシュボードからダウンロード可能です</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
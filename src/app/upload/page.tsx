import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DynamicUploadForm } from '@/lib/optimization/dynamic-components';

export const revalidate = 0;

// Upload page skeleton
function UploadSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-4 bg-slate-200 rounded w-32"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>

        {/* Upload form skeleton */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
          <div className="space-y-6">
            <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
            
            {/* Upload area skeleton */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-12">
              <div className="text-center space-y-4">
                <div className="h-12 w-12 bg-slate-200 rounded mx-auto"></div>
                <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
                <div className="h-10 bg-slate-200 rounded w-32 mx-auto"></div>
              </div>
            </div>
            
            {/* Settings skeleton */}
            <div className="space-y-4">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-10 bg-slate-200 rounded w-1/3"></div>
              <div className="h-10 bg-blue-200 rounded w-32"></div>
            </div>
          </div>
        </div>

        {/* Instructions skeleton */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <div className="space-y-3">
            <div className="h-5 bg-blue-200 rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-blue-200 rounded w-full"></div>
              <div className="h-4 bg-blue-200 rounded w-3/4"></div>
              <div className="h-4 bg-blue-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function UploadPage() {
  const supabase = await createClient();
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/dashboard"
              className="text-slate-600 hover:text-slate-900 transition-colors duration-200 text-sm"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            PowerPointファイルをアップロード
          </h1>
          <p className="text-slate-600">
            翻訳したいPowerPointファイルを選択してください。サポートされている形式: .pptx
          </p>
        </div>

        {/* Upload form with loading boundary */}
        <Suspense fallback={<UploadSkeleton />}>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <DynamicUploadForm />
          </div>
        </Suspense>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-3">アップロードの手順</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>PowerPointファイル（.pptx形式）を選択またはドラッグ&ドロップ</li>
            <li>翻訳先の言語を選択</li>
            <li>「アップロード」ボタンをクリック</li>
            <li>ファイルが処理されるまでお待ちください</li>
            <li>処理完了後、プレビュー画面で内容を確認できます</li>
          </ol>
        </div>

        {/* File size and format info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-gray-900 mb-2">ファイル制限</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 最大ファイルサイズ: 50MB</li>
            <li>• サポート形式: PowerPoint (.pptx) のみ</li>
            <li>• テーブル、画像、図形を含むスライドも対応</li>
            <li>• パスワード保護されたファイルは事前に保護を解除してください</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: 'ファイルアップロード - PowerPoint翻訳ツール',
    description: 'PowerPointファイルをアップロードして翻訳を開始します。',
  };
}
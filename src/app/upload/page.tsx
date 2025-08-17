import UploadForm from '@/components/upload/UploadForm';
import Link from 'next/link';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">PowerPointファイルのアップロード</h1>
          
          <UploadForm />
          
          <div className="mt-6">
            <Link 
              href="/dashboard"
              className="inline-block px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
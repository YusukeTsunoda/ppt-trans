import { uploadFileAction } from '@/app/actions/upload';
import UploadForm from '@/components/upload/UploadForm';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';

export default function UploadPage() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">PowerPointファイルのアップロード</h1>
          
          <UploadForm action={uploadFileAction} />
          
          <div className="mt-6">
            <Link 
              href="/dashboard"
              className="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded-lg 
                       hover:bg-slate-200 transition-all duration-200"
            >
              ← ダッシュボードに戻る
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
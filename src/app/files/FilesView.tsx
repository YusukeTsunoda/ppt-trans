'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { deleteFileAction, downloadFileAction } from '@/app/actions/files';
import { FileRecord } from '@/lib/data/files';
import { Loader2, Trash2, Download, FileText, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

function DeleteButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
      title="削除"
    >
      {pending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Trash2 className="w-5 h-5" />
      )}
    </button>
  );
}

function DownloadButton() {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
      title="ダウンロード"
    >
      {pending ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Download className="w-5 h-5" />
      )}
    </button>
  );
}

interface FilesViewProps {
  userEmail: string;
  initialFiles: FileRecord[];
}

export default function FilesView({ initialFiles }: FilesViewProps) {
  const [files, setFiles] = useState<FileRecord[]>(initialFiles);
  const [deleteState, deleteFormAction] = useActionState(deleteFileAction, null);
  const [downloadState, downloadFormAction] = useActionState(downloadFileAction, null);
  
  // ファイル削除時のOptimistic Update
  const handleDeleteWithOptimistic = (fileId: string) => {
    if (!confirm('このファイルを削除してもよろしいですか？')) {
      return;
    }
    
    // Optimistic update
    setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
  };
  
  // フォーマット関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    if (minutes > 0) return `${minutes}分前`;
    return 'たった今';
  };
  
  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
  
  // ダウンロード処理
  const handleDownload = async (signedUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // ダウンロードURLが返ってきたら処理
  if (downloadState?.success && downloadState.message) {
    handleDownload(downloadState.message, 'download.pptx');
  }
  
  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            ファイル管理
          </h1>
          <Link
            href="/dashboard"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            新しいファイルをアップロード
          </Link>
        </div>

        {/* エラーメッセージ */}
        {deleteState?.error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
              <p className="text-red-700 dark:text-red-300">{deleteState.error}</p>
            </div>
          </div>
        )}
        
        {/* 成功メッセージ */}
        {deleteState?.success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-700 dark:text-green-300">{deleteState.message}</p>
          </div>
        )}

        {/* ファイル一覧 */}
        {files.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              まだファイルがありません
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {file.original_filename || file.filename}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                      <span>•</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        file.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : file.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : file.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                      }`}>
                        {file.status === 'completed' ? '完了' :
                         file.status === 'processing' ? '処理中' :
                         file.status === 'failed' ? '失敗' : 'アップロード済み'}
                      </span>
                    </div>
                    {file.translation_result?.error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        エラー: {file.translation_result.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {/* ダウンロードボタン */}
                    <form action={downloadFormAction}>
                      <input type="hidden" name="fileId" value={file.id} />
                      <input type="hidden" name="fileType" value="original" />
                      <DownloadButton />
                    </form>
                    
                    {/* 翻訳済みファイルのダウンロード */}
                    {file.status === 'completed' && file.translation_result?.translated_path && (
                      <form action={downloadFormAction}>
                        <input type="hidden" name="fileId" value={file.id} />
                        <input type="hidden" name="fileType" value="translated" />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          翻訳済み
                        </button>
                      </form>
                    )}
                    
                    {/* 削除ボタン */}
                    <form 
                      action={deleteFormAction}
                      onSubmit={() => handleDeleteWithOptimistic(file.id)}
                    >
                      <input type="hidden" name="fileId" value={file.id} />
                      <DeleteButton />
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
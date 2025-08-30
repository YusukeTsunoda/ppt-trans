'use client';

import { useState, useCallback, memo } from 'react';
import Link from 'next/link';
import { deleteFileAction, downloadFileAction } from '@/app/actions/files';
import { FileRecord } from '@/lib/data/files';
import { Loader2, Trash2, Download, FileText } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

interface FilesViewProps {
  userEmail: string;
  initialFiles: FileRecord[];
}

export default function FilesView({ initialFiles }: FilesViewProps) {
  const [files, setFiles] = useState<FileRecord[]>(initialFiles);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  
  // ファイル削除時の処理
  const handleDelete = useCallback(async (fileId: string) => {
    if (!confirm('このファイルを削除してもよろしいですか？')) {
      return;
    }
    setDeletingFileId(fileId);
    try {
      const result = await deleteFileAction(fileId);
      if (result.success) {
        setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
      } else {
        alert(result.error || 'ファイルの削除に失敗しました');
      }
    } finally {
      setDeletingFileId(null);
    }
  }, []);
  
  // ファイルダウンロード時の処理
  const handleDownload = useCallback(async (fileId: string, fileType: 'original' | 'translated') => {
    setDownloadingFileId(fileId);
    try {
      const result = await downloadFileAction(fileId, fileType);
      if (result.success && result.message) {
        // ダウンロードURLが返ってくるので、それを使ってダウンロード
        window.open(result.message, '_blank');
      } else {
        alert(result.error || 'ダウンロードに失敗しました');
      }
    } finally {
      setDownloadingFileId(null);
    }
  }, []);
  
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
                      {file.original_name || file.filename}
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
                    {file.extracted_data?.error && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        エラー: {file.extracted_data.error}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {/* ダウンロードボタン */}
                    <button
                      onClick={() => handleDownload(file.id, 'original')}
                      disabled={downloadingFileId === file.id}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {downloadingFileId === file.id ? (
                        <span className="flex items-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ダウンロード中...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Download className="w-4 h-4 mr-2" />
                          ダウンロード
                        </span>
                      )}
                    </button>
                    
                    {/* 翻訳済みファイルのダウンロード */}
                    {file.status === 'completed' && file.extracted_data?.translated_path && (
                      <button
                        onClick={() => handleDownload(file.id, 'translated')}
                        disabled={downloadingFileId === file.id}
                        className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        翻訳済み
                      </button>
                    )}
                    
                    {/* 削除ボタン */}
                    <button
                      onClick={() => handleDelete(file.id)}
                      disabled={deletingFileId === file.id}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {deletingFileId === file.id ? (
                        <span className="flex items-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          削除中...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Trash2 className="w-4 h-4 mr-2" />
                          削除
                        </span>
                      )}
                    </button>
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
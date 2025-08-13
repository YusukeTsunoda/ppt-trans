'use client';

import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect, useTransition, useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { downloadFile } from '@/lib/downloadUtils';
import { listFilesAction, type FileWithTranslations, type ListFilesResult } from '@/lib/server-actions/files/list';
import { deleteFileAction, type DeleteFileResult } from '@/lib/server-actions/files/delete';
import { type ServerActionState } from '@/lib/server-actions/types';
import { Loader2, Trash2, Download, FileText, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

// date-fnsを動的インポート
const formatDate = (date: Date): string => {
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

export default function FilesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileWithTranslations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  
  // Optimistic updates for file deletion
  const [optimisticFiles, setOptimisticFiles] = useOptimistic(
    files,
    (state: FileWithTranslations[], deletedFileId: string) => 
      state.filter(f => f.id !== deletedFileId)
  );

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    fetchFiles();
  }, [user, loading, router]);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Server ActionはFormDataと初期状態を期待
      const formData = new FormData();
      formData.append('page', '1');
      formData.append('pageSize', '50');
      formData.append('sortBy', 'createdAt');
      formData.append('sortOrder', 'desc');
      
      const initialState: ServerActionState<ListFilesResult> = {
        success: false,
        message: '',
        timestamp: Date.now()
      };
      
      const result = await listFilesAction(initialState, formData);
      
      if (result.success && result.data?.files) {
        setFiles(result.data.files);
      } else {
        setError(result.message || 'ファイルの取得に失敗しました');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setError('ファイルの取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`「${fileName}」を削除してもよろしいですか？`)) {
      return;
    }

    setDeletingFileId(fileId);
    setMessage('');
    setError(null);

    // Optimistic update
    startTransition(() => {
      setOptimisticFiles(fileId);
    });

    try {
      // Server ActionはFormDataと初期状態を期待
      const formData = new FormData();
      formData.append('fileId', fileId);
      
      const initialState: ServerActionState<DeleteFileResult> = {
        success: false,
        message: '',
        timestamp: Date.now()
      };
      
      const result = await deleteFileAction(initialState, formData);
      
      if (result.success) {
        setMessage('ファイルを削除しました');
        // Server Actionが成功したら実際のファイルリストを更新
        setFiles(prev => prev.filter(f => f.id !== fileId));
      } else {
        // 削除に失敗した場合は元に戻す
        setError(result.message || 'ファイルの削除に失敗しました');
        await fetchFiles(); // リストを再取得
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      setError('ファイルの削除中にエラーが発生しました');
      await fetchFiles(); // リストを再取得
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleDownload = async (file: FileWithTranslations) => {
    const success = await downloadFile({
      url: file.translatedFileUrl || file.originalFileUrl,
      fileName: file.fileName
    });

    if (!success) {
      setMessage('ダウンロードに失敗しました');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      COMPLETED: 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200',
      FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };

    const statusLabels = {
      PENDING: '処理待ち',
      PROCESSING: '処理中',
      COMPLETED: '完了',
      FAILED: '失敗',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status as keyof typeof statusStyles] || ''}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout currentPage="files">
      <div className="max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ファイル管理</h1>
          <p className="text-gray-600 dark:text-gray-400">
            アップロードしたファイルの一覧と管理
          </p>
        </div>

      {/* メッセージ表示 */}
      {message && (
        <div className="mb-6 p-4 bg-accent-50 border border-accent-200 rounded-lg text-accent-800 dark:bg-accent-900/20 dark:border-accent-800 dark:text-accent-200">
          {message}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* アップロードボタン */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-5 h-5 mr-2" />
          新しいファイルをアップロード
        </Link>
      </div>

      {/* ファイルリスト */}
      {optimisticFiles.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            まだファイルがありません
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            最初のファイルをアップロード
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ファイル名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    サイズ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    翻訳
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    アップロード日時
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {optimisticFiles.map((file) => (
                  <tr key={file.id} className={isPending && deletingFileId === file.id ? 'opacity-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {file.fileName}
                          </div>
                          {file.totalSlides && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {file.totalSlides} スライド
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatBytes(file.fileSize)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(file.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {file.translations.length > 0 ? (
                        <span className="text-accent-600 dark:text-accent-400">
                          {file.translations.length} 件の翻訳
                        </span>
                      ) : (
                        <span className="text-gray-400">未翻訳</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(new Date(file.createdAt))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {file.translatedFileUrl && (
                          <button
                            onClick={() => handleDownload(file)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="ダウンロード"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(file.id, file.fileName)}
                          disabled={deletingFileId === file.id}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                          title="削除"
                        >
                          {deletingFileId === file.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
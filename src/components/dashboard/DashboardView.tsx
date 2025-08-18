'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { translateFileAction, deleteFileAction } from '@/app/actions/dashboard';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import logger from '@/lib/logger';
import { User, LogOut, Upload } from 'lucide-react';

interface FileRecord {
  id: string;
  filename: string;
  original_name: string;  // original_filename -> original_nameに修正
  file_size: number;
  status: string;
  translation_result?: {
    translated_path?: string;
    slide_count?: number;
    error?: string;
  };
  created_at: string;
}

interface DashboardViewProps {
  userEmail: string;
  initialFiles: FileRecord[];
}

function TranslateButton({ fileId }: { fileId: string }) {
  const { pending } = useFormStatus();
  
  return (
    <>
      <input type="hidden" name="fileId" value={fileId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200"
      >
        {pending ? '翻訳中...' : '🌐 翻訳'}
      </button>
    </>
  );
}


function FileCard({ file, onDelete }: { file: FileRecord; onDelete: (fileId: string) => void }) {
  const [translateState, translateAction] = useActionState(translateFileAction, null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      uploaded: 'bg-blue-100 text-blue-800',
      processing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };
    
    const statusLabels = {
      uploaded: 'アップロード済み',
      processing: '処理中',
      completed: '完了',
      failed: '失敗'
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800'}`}>
        {statusLabels[status as keyof typeof statusLabels] || status}
      </span>
    );
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('uploads')
        .download(storagePath);
      
      if (error) throw error;
      
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download error:', error);
      alert('ダウンロードに失敗しました');
    }
  };

  // 削除ボタンのクリックハンドラ
  const handleDelete = async () => {
    if (!confirm('このファイルを削除してもよろしいですか？')) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(file.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {file.original_name}
        </div>
        {file.translation_result?.slide_count && (
          <div className="text-xs text-gray-500">
            {file.translation_result.slide_count} スライド
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatFileSize(file.file_size)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(file.status)}
        {file.translation_result?.error && (
          <div className="text-xs text-red-600 mt-1">
            {file.translation_result.error}
          </div>
        )}
        {translateState?.error && (
          <div className="text-xs text-red-600 mt-1">
            {translateState.error}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(file.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2">
          {/* 元ファイルダウンロード */}
          <button
            onClick={() => handleDownload(file.filename, file.original_name)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            元ファイル
          </button>
          
          {/* プレビューボタン */}
          {file.status === 'uploaded' && (
            <Link
              href={`/preview/${file.id}`}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
            >
              📄 プレビュー
            </Link>
          )}
          
          {/* 翻訳ボタン */}
          {file.status === 'uploaded' && (
            <form action={translateAction}>
              <TranslateButton fileId={file.id} />
            </form>
          )}
          
          {/* 処理中表示 */}
          {file.status === 'processing' && (
            <span className="text-sm text-yellow-600">
              処理中...
            </span>
          )}
          
          {/* 翻訳済みファイルダウンロード */}
          {file.status === 'completed' && file.translation_result?.translated_path && (
            <button
              onClick={() => handleDownload(
                file.translation_result!.translated_path!,
                `translated_${file.original_name}`
              )}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
            >
              翻訳済み
            </button>
          )}
          
          {/* 削除ボタン */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {isDeleting ? '削除中...' : '削除'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DashboardView({ userEmail, initialFiles }: DashboardViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const router = useRouter();

  const handleLogout = async () => {
    const result = await logoutAction();
    if (result.success) {
      router.push('/login');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      // FormDataにfileIdを追加
      const formData = new FormData();
      formData.append('fileId', fileId);
      const deleteResult = await deleteFileAction(null, formData);
      
      if (deleteResult.success) {
        // ローカルの状態を更新（楽観的UI更新）
        setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
      } else {
        alert(deleteResult.error || 'ファイルの削除に失敗しました');
      }
    } catch (error) {
      logger.error('Delete error:', error);
      alert('ファイルの削除中にエラーが発生しました');
    }
  };

  return (
    <div className="min-h-screen gradient-bg animate-fadeIn">
      {/* ヘッダー */}
      <div className="header-gradient text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">PowerPoint Translator</h1>
              <p className="text-blue-100 text-sm mt-1">ようこそ、{userEmail}さん</p>
            </div>
            <div className="flex items-center gap-2">
              {/* プロフィールボタン */}
              <Link
                href="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-all duration-200 text-sm"
                title="プロフィール設定"
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">プロフィール</span>
              </Link>
              
              {/* 新規アップロードボタン */}
              <Link
                href="/upload"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                data-testid="new-upload-link"
              >
                <Upload className="w-4 h-4" />
                <span>新規アップロード</span>
              </Link>
              
              {/* ログアウトボタン */}
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white backdrop-blur rounded-lg transition-all duration-200 text-sm"
                  title="ログアウト"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">ログアウト</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ファイル一覧 */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900" data-testid="uploaded-files-title">アップロードしたファイル</h2>
            <button
              onClick={async () => {
                // ダッシュボードページをリロードして最新データを取得
                window.location.reload();
              }}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              title="更新"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {files.length === 0 ? (
            <div className="p-12 text-center" data-testid="empty-file-list">
              <svg className="mx-auto h-24 w-24 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-600 mb-4">まだファイルがアップロードされていません</p>
              <Link
                href="/upload"
                className="btn-primary inline-block"
              >
                最初のファイルをアップロード
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto file-list" data-testid="file-list">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ファイル名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      サイズ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アップロード日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <FileCard key={file.id} file={file} onDelete={handleDeleteFile} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
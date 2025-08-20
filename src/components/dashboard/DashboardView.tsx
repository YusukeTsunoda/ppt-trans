'use client';

import { useState } from 'react';
import { translateFileAction, deleteFileAction } from '@/app/actions/dashboard';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import logger from '@/lib/logger';
import { User, LogOut, Upload, FileText, Clock, Download, Trash2, Play, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useTranslation } from '@/hooks/useTranslation';

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


function FileCard({ file, onDelete }: { file: FileRecord; onDelete: (fileId: string) => void }) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t, language } = useTranslation();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const locale = language === 'ja' ? 'ja-JP' : 
                   language === 'zh' ? 'zh-CN' : 
                   language === 'ko' ? 'ko-KR' : 'en-US';
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      uploaded: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      processing: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300',
      completed: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      failed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    };
    
    const statusLabels = {
      uploaded: t('uploaded'),
      processing: t('processing'),
      completed: t('completed'),
      failed: t('failed')
    };
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'}`}>
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
      alert(t('downloadFailed'));
    }
  };

  // 削除ボタンのクリックハンドラ
  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) {
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
    <tr className="hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors duration-200">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {file.original_name}
            </div>
            {file.translation_result?.slide_count && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {file.translation_result.slide_count} {t('slides')}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300 font-medium">
        {formatFileSize(file.file_size)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(file.status)}
        {file.translation_result?.error && (
          <div className="text-xs text-red-600 mt-1">
            {file.translation_result.error}
          </div>
        )}
        {translateError && (
          <div className="text-xs text-red-600 mt-1">
            {translateError}
          </div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          {formatDate(file.created_at)}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex gap-2">
          {/* 元ファイルダウンロード */}
          <button
            onClick={() => handleDownload(file.filename, file.original_name)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            <Download className="w-4 h-4 inline mr-1" />
            {t('originalFile')}
          </button>
          
          {/* プレビューボタン */}
          {file.status === 'uploaded' && (
            <Link
              href={`/preview/${file.id}`}
              className="inline-flex items-center gap-1 text-sm bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl border-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-slate-600 transition-all duration-200 font-medium"
            >
              <FileText className="w-4 h-4" />
              {t('preview')}
            </Link>
          )}
          
          {/* 翻訳ボタン */}
          {file.status === 'uploaded' && (
            <button
              onClick={async () => {
                setIsTranslating(true);
                setTranslateError(null);
                try {
                  const result = await translateFileAction(file.id);
                  if (!result.success) {
                    setTranslateError(result.error || t('translationError'));
                  }
                } finally {
                  setIsTranslating(false);
                }
              }}
              disabled={isTranslating}
              className="inline-flex items-center gap-1 text-sm bg-gradient-to-r from-blue-600 to-sky-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-sky-700 disabled:opacity-50 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              {isTranslating ? t('translating') : (
                <>
                  <Play className="w-4 h-4" />
                  {t('translate')}
                </>
              )}
            </button>
          )}
          
          {/* 処理中表示 */}
          {file.status === 'processing' && (
            <span className="text-sm text-yellow-600">
              {t('processing')}...
            </span>
          )}
          
          {/* 翻訳済みファイルダウンロード */}
          {file.status === 'completed' && file.translation_result?.translated_path && (
            <button
              onClick={() => handleDownload(
                file.translation_result!.translated_path!,
                `translated_${file.original_name}`
              )}
              className="inline-flex items-center gap-1 text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-2 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              {t('translatedFile')}
            </button>
          )}
          
          {/* 削除ボタン */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {isDeleting ? t('deleting') : t('delete')}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DashboardView({ userEmail, initialFiles }: DashboardViewProps) {
  const [files, setFiles] = useState(initialFiles);
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    const result = await logoutAction();
    if (result.success) {
      router.push('/login');
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      // 直接fileIdを渡すようにシンプル化
      const deleteResult = await deleteFileAction(fileId);
      
      if (deleteResult.success) {
        // ローカルの状態を更新（楽観的UI更新）
        setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
      } else {
        alert(deleteResult.error || t('deleteError'));
      }
    } catch (error) {
      logger.error('Delete error:', error);
      alert(t('deleteProcessError'));
    }
  };

  return (
    <div className="min-h-screen gradient-bg dark:bg-slate-900 animate-fadeIn">
      {/* ヘッダー */}
      <div className="header-gradient dark:bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('appName')}</h1>
              <p className="text-blue-100 text-sm mt-1">{userEmail}{t('welcomeMessage')}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* 言語切り替え */}
              <LanguageToggle />
              
              {/* ダークモード切り替え */}
              <ThemeToggle />
              
              {/* プロフィールボタン */}
              <Link
                href="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 backdrop-blur rounded-lg transition-all duration-200 text-sm"
                title={t('profileSettings')}
              >
                <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-sky-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline">{t('profile')}</span>
              </Link>
              
              {/* 新規アップロードボタン */}
              <Link
                href="/upload"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                data-testid="new-upload-link"
              >
                <Upload className="w-4 h-4" />
                <span>{t('newUpload')}</span>
              </Link>
              
              {/* ログアウトボタン */}
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 border-2 border-slate-200 hover:border-red-200 rounded-xl transition-all duration-200 text-sm font-medium"
                  title={t('logout')}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('logout')}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ファイル一覧 */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="uploaded-files-title">
              {t('uploadedFiles')}
            </h2>
            <button
              onClick={async () => {
                window.location.reload();
              }}
              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-all duration-200"
              title={t('refresh')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {files.length === 0 ? (
            <div className="py-20 text-center" data-testid="empty-file-list">
              <div className="w-32 h-32 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <FileText className="w-16 h-16 text-blue-400 dark:text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('noFiles')}</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-6">{t('uploadFirst')}</p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-sky-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-sky-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <Upload className="w-5 h-5" />
                {t('uploadYourFirst')}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="file-list">
              <table className="w-full">
                <thead className="bg-blue-50 dark:bg-slate-700 border-b border-blue-100 dark:border-slate-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('fileName')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('size')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('status')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('uploadDate')}
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
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
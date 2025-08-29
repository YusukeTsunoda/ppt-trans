'use client';

import { useState } from 'react';
// @ts-ignore - React 19 exports
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { translateFileAction, deleteFileAction } from '@/app/actions/dashboard';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState as useStateReact } from 'react';
import { SkeletonTable } from '@/components/ui/SkeletonLoader';
import RealtimeProgress from '@/components/progress/RealtimeProgress';

interface FileRecord {
  id: string;
  filename: string;
  original_filename: string;
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

function DeleteButton({ fileId }: { fileId: string }) {
  const { pending } = useFormStatus();
  
  return (
    <>
      <input type="hidden" name="fileId" value={fileId} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {pending ? '削除中...' : '削除'}
      </button>
    </>
  );
}

function FileCard({ file }: { file: FileRecord }) {
  const [translateState, translateAction] = useActionState(translateFileAction, null);
  const [deleteState, deleteAction] = useActionState(deleteFileAction, null);
  const router = useRouter();

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
    // Design.md準拠のステータス表示
    const statusStyles = {
      uploaded: 'bg-blue-100 text-blue-600',
      processing: 'bg-blue-100 text-blue-600 animate-pulse', // Design.md: 翻訳中のアニメーション
      completed: 'bg-emerald-100 text-emerald-600', // Design.md: アクセントカラー
      failed: 'bg-red-100 text-red-600'
    };
    
    const statusLabels = {
      uploaded: 'アップロード済み',
      processing: '処理中',
      completed: '完了',
      failed: '失敗'
    };
    
    return (
      <span className={`px-3 py-1 text-xs font-medium rounded-lg ${statusStyles[status as keyof typeof statusStyles] || 'bg-slate-100 text-slate-600'}`}>
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
      console.error('Download error:', error);
      alert('ダウンロードに失敗しました');
    }
  };

  // 状態に応じてページをリフレッシュ
  if (translateState?.success || deleteState?.success) {
    router.refresh();
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {file.original_filename}
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
            onClick={() => handleDownload(file.filename, file.original_filename)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            元ファイル
          </button>
          
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
                `translated_${file.original_filename}`
              )}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all duration-200"
            >
              翻訳済み
            </button>
          )}
          
          {/* 削除ボタン */}
          <form action={deleteAction}>
            <DeleteButton fileId={file.id} />
          </form>
        </div>
      </td>
    </tr>
  );
}

export default function DashboardView({ userEmail, initialFiles }: DashboardViewProps) {
  const [files] = useState(initialFiles);
  const [isAdmin, setIsAdmin] = useStateReact(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // ユーザーロールを確認
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        const userRole = profile?.role?.toLowerCase();
        setIsAdmin(userRole === 'admin' || userRole === 'super_admin');
      }
    };
    checkUserRole();
  }, [supabase]);

  const handleLogout = async () => {
    const result = await logoutAction();
    if (result.success) {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-fadeIn">
      {/* ヘッダー (Design.md準拠) */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-heading font-bold">PowerPoint Translator</h1>
              <p className="text-blue-100 mt-1 font-body">ようこそ、{userEmail}さん</p>
            </div>
            <div className="flex gap-3">
              {/* 管理者ダッシュボードボタン（管理者のみ表示） */}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="btn-secondary bg-orange-500 hover:bg-orange-600 text-white"
                >
                  🛠️ 管理画面
                </Link>
              )}
              
              {/* プロフィールボタン */}
              <Link
                href="/profile"
                className="btn-secondary bg-slate-600 hover:bg-slate-700 text-white"
              >
                👤 プロフィール
              </Link>
              
              {/* 新規アップロードボタン (Design.md準拠のアクセントカラー) */}
              <Link
                href="/upload"
                className="btn-accent"
              >
                📄 新規アップロード
              </Link>
              
              {/* ログアウトボタン */}
              <form action={handleLogout}>
                <button
                  type="submit"
                  className="btn-secondary bg-white/20 hover:bg-white/30 text-white backdrop-blur"
                >
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* クイックアクセスカード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* プロフィールカード (Design.md準拠) */}
          <Link
            href="/profile"
            className="card hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-all duration-200">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-slate-900">プロフィール設定</h3>
                <p className="text-sm text-slate-600 font-body">アカウント情報の確認・編集</p>
              </div>
            </div>
          </Link>

          {/* ファイル管理カード (Design.md準拠) */}
          <Link
            href="/files"
            className="card hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-all duration-200">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-slate-900">ファイル管理</h3>
                <p className="text-sm text-slate-600 font-body">アップロード済みファイルの一覧</p>
              </div>
            </div>
          </Link>

          {/* 管理画面カード（管理者のみ）(Design.md準拠) */}
          {isAdmin && (
            <Link
              href="/admin"
              className="card hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-all duration-200">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-slate-900">管理画面</h3>
                  <p className="text-sm text-slate-600 font-body">システム管理・統計情報</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* ファイル一覧 */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">アップロードしたファイル</h2>
            <button
              onClick={() => router.refresh()}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              title="更新"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {files.length === 0 ? (
            <div className="p-12 text-center">
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
            <div className="overflow-x-auto">
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
                    <FileCard key={file.id} file={file} />
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
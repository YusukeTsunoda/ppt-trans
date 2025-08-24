'use client';

import { useActionState } from 'react';
import { uploadFileAction } from '@/app/actions/upload';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '@/constants/mime-types';

/**
 * 最適化されたアップロードフォーム
 * - DOM構造の自然な順序を保持
 * - アクセシビリティ準拠
 * - React制御/非制御の衝突を回避
 */
export default function UploadFormOptimized() {
  const [state, formAction] = useActionState(uploadFileAction, null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [clientError, setClientError] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  // 成功時にダッシュボードへリダイレクト
  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state?.success, router]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setClientError(''); // エラーをクリア
    
    if (file) {
      // ファイル形式のバリデーション
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (fileExtension !== '.ppt' && fileExtension !== '.pptx') {
        setClientError('PowerPointファイル（.ppt, .pptx）のみアップロード可能です');
        e.target.value = ''; // ファイル選択をクリア
        setFileName('');
        setFileSize(0);
        return;
      }
      
      // ファイルサイズのバリデーション
      if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        setClientError(`ファイルサイズが大きすぎます。最大${FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}までアップロード可能です。（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）`);
        e.target.value = ''; // ファイル選択をクリア
        setFileName('');
        setFileSize(0);
        return;
      }
      
      // バリデーションが成功した場合のみファイル情報を設定
      setFileName(file.name);
      setFileSize(file.size);
    } else {
      setFileName('');
      setFileSize(0);
    }
  };

  // フォーム送信をラップして遷移状態を管理
  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      formAction(formData);
    });
  };
  
  const isSubmitDisabled = isPending || !!clientError || !fileName || state?.success;
  
  return (
    <form 
      action={handleSubmit} 
      className="space-y-4" 
      data-testid="upload-form" 
      id="upload-form"
      aria-label="PowerPointファイルアップロードフォーム"
    >
      <fieldset disabled={state?.success} className="space-y-4">
        <legend className="sr-only">ファイルアップロードフォーム</legend>
        
        {/* ファイル選択セクション */}
        <div className="form-group">
          <label 
            htmlFor="file-input" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            ファイルを選択
            <span className="text-red-500 ml-1" aria-label="必須項目">*</span>
          </label>
          
          <input
            id="file-input"
            type="file"
            name="file"
            accept={FILE_EXTENSIONS.POWERPOINT}
            onChange={handleFileChange}
            disabled={state?.success}
            required
            aria-required="true"
            aria-invalid={!!clientError}
            aria-describedby={`file-help ${clientError ? 'file-error' : ''}`}
            className="block w-full text-sm text-gray-500 
              file:mr-4 file:py-2 file:px-4 
              file:rounded-md file:border-0 
              file:text-sm file:font-semibold 
              file:bg-blue-50 file:text-blue-700 
              hover:file:bg-blue-100 
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          />
          
          <p id="file-help" className="mt-1 text-sm text-gray-500">
            対応形式: .pptx, .ppt（最大{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}）
          </p>
          
          {/* クライアントエラー表示 */}
          {clientError && (
            <p 
              id="file-error" 
              role="alert" 
              className="mt-2 text-sm text-red-600"
              aria-live="polite"
            >
              <span className="font-medium">エラー:</span> {clientError}
            </p>
          )}
        </div>
        
        {/* 選択ファイル情報表示 */}
        {fileName && !clientError && (
          <div 
            className="p-3 bg-gray-50 border border-gray-200 rounded-md"
            role="status"
            aria-live="polite"
            aria-label="選択されたファイル情報"
          >
            <dl className="space-y-1">
              <div className="flex">
                <dt className="font-medium text-sm text-gray-700">ファイル名:</dt>
                <dd className="ml-2 text-sm text-gray-900">{fileName}</dd>
              </div>
              <div className="flex">
                <dt className="font-medium text-sm text-gray-700">サイズ:</dt>
                <dd className="ml-2 text-sm text-gray-900">
                  {(fileSize / 1024 / 1024).toFixed(2)} MB
                </dd>
              </div>
            </dl>
          </div>
        )}
        
        {/* 処理中の表示 */}
        {isPending && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md" role="status" aria-live="polite">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-blue-700 text-sm">
                アップロード処理中... 大きなファイルの場合、時間がかかることがあります。
              </span>
            </div>
          </div>
        )}
        
        {/* サーバーエラー表示 */}
        {state?.error && (
          <div 
            className={`p-3 border rounded-md ${
              state.error.includes('タイムアウト') 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-red-50 border-red-200'
            }`}
            data-testid="upload-error"
            role="alert"
            aria-live="assertive"
          >
            <p className={`text-sm ${
              state.error.includes('タイムアウト') 
                ? 'text-orange-700' 
                : 'text-red-700'
            }`}>
              <span className="font-medium">エラー:</span> {state.error}
            </p>
            {state.error.includes('タイムアウト') && (
              <div className="mt-2 text-sm text-orange-600">
                <p className="font-medium">解決方法:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>ネットワーク接続を確認してください</li>
                  <li>ファイルサイズを小さくして再試行してください</li>
                  <li>問題が続く場合は、しばらく待ってから再度お試しください</li>
                </ul>
              </div>
            )}
          </div>
        )}
        
        {/* 成功メッセージ表示 */}
        {state?.success && (
          <div 
            className="p-3 bg-green-50 border border-green-200 rounded-md" 
            data-testid="upload-success"
            role="status"
            aria-live="polite"
          >
            <p className="text-green-700 text-sm">
              <span className="font-medium">成功:</span> {state.message} 
              <span className="block mt-1">ダッシュボードに移動します...</span>
            </p>
          </div>
        )}
        
        {/* 送信ボタン - DOM順序の最後に配置 */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          aria-busy={isPending}
          aria-disabled={isSubmitDisabled}
          data-testid="upload-button"
          className={`
            w-full px-4 py-2 
            text-white font-medium rounded-md
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            ${isSubmitDisabled 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {isPending ? (
            <span className="flex items-center justify-center">
              <svg 
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle 
                  className="opacity-25" 
                  cx="12" cy="12" r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              アップロード中...
            </span>
          ) : (
            'アップロード'
          )}
        </button>
      </fieldset>
    </form>
  );
}
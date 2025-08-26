'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadFileAction } from '@/app/actions/upload';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '@/constants/mime-types';

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="upload-button"
      aria-label={pending ? "ファイルをアップロード中" : "ファイルをアップロード"}
    >
      {pending ? (
        <>
          <svg className="inline-block mr-2 animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          アップロード中...
        </>
      ) : (
        'アップロード'
      )}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useActionState(uploadFileAction, null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [clientError, setClientError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  
  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (clientError === 'ネットワークエラー: インターネット接続を確認してください') {
        setClientError('');
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setClientError('ネットワークエラー: インターネット接続を確認してください');
    };
    
    // 初期状態をチェック
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setClientError('ネットワークエラー: インターネット接続を確認してください');
    }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [clientError]);
  
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
  
  return (
    <form action={formAction} className="space-y-4" data-testid="upload-form" id="upload-form">
      <div>
        <label htmlFor="file-input" className="block text-sm font-medium mb-2">
          ファイルを選択
        </label>
        <input
          id="file-input"
          type="file"
          name="file"
          accept={FILE_EXTENSIONS.POWERPOINT}
          onChange={handleFileChange}
          disabled={state?.success}
          required
          aria-label="PowerPointファイルを選択"
          aria-describedby="file-help"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <p id="file-help" className="mt-1 text-sm text-gray-500">
          対応形式: .pptx, .ppt（最大{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}）
        </p>
      </div>
      
      {fileName && (
        <div className="p-3 bg-gray-100 rounded">
          <p className="text-sm">
            <span className="font-medium">選択されたファイル:</span> {fileName}
          </p>
          <p className="text-sm">
            <span className="font-medium">サイズ:</span> {(fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}
      
      {(clientError || state?.error) && (
        <div className="p-3 bg-red-50 border border-red-200 rounded" data-testid="upload-error">
          <p className="text-red-700 text-sm">{clientError || state?.error}</p>
        </div>
      )}
      
      {state?.success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded" data-testid="upload-success">
          <p className="text-green-700 text-sm">
            {state.message} ダッシュボードに移動します...
          </p>
        </div>
      )}
      
      {!isOnline && fileName && (
        <button
          type="button"
          onClick={() => {
            if (navigator.onLine) {
              setIsOnline(true);
              setClientError('');
            }
          }}
          className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 mr-2"
        >
          再試行
        </button>
      )}
      <SubmitButton disabled={!!clientError || !fileName || !isOnline} />
    </form>
  );
}
export default UploadForm;

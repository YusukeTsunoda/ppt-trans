'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadFileAction } from '@/app/actions/upload';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '@/constants/mime-types';
import { useTranslation } from '@/hooks/useTranslation';

function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="upload-button"
      aria-label={pending ? t('uploading') : t('upload')}
    >
      {pending ? (
        <>
          <svg className="inline-block mr-2 animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          {t('uploading')}
        </>
      ) : (
        t('upload')
      )}
    </button>
  );
}

export default function UploadForm() {
  const [state, formAction] = useActionState(uploadFileAction, null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [clientError, setClientError] = useState<string>('');
  const router = useRouter();
  const { t } = useTranslation();
  
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
        setClientError(t('onlyPowerPointAllowed') || 'PowerPointファイル（.ppt, .pptx）のみアップロード可能です');
        e.target.value = ''; // ファイル選択をクリア
        setFileName('');
        setFileSize(0);
        return;
      }
      
      // ファイルサイズのバリデーション
      if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        setClientError(t('fileTooLarge') ? t('fileTooLarge').replace('{maxSize}', FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL).replace('{currentSize}', `${(file.size / 1024 / 1024).toFixed(2)}MB`) : `ファイルサイズが大きすぎます。最大${FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}までアップロード可能です。（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）`);
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
        <label htmlFor="file-input" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          {t('selectFile')}
        </label>
        <input
          id="file-input"
          type="file"
          name="file"
          accept={FILE_EXTENSIONS.POWERPOINT}
          onChange={handleFileChange}
          disabled={state?.success}
          required
          aria-label={t('selectFile')}
          aria-describedby="file-help"
          className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50 disabled:opacity-50"
        />
        <p id="file-help" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('supportedFormats')}{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}）
        </p>
      </div>
      
      {fileName && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{t('selectedFile')}:</span> {fileName}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{t('fileSize')}:</span> {(fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}
      
      {(clientError || state?.error) && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded" data-testid="upload-error">
          <p className="text-red-700 dark:text-red-400 text-sm">{clientError || state?.error}</p>
        </div>
      )}
      
      {state?.success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded" data-testid="upload-success">
          <p className="text-green-700 dark:text-green-400 text-sm">
            {state.message} {t('redirectingToDashboard') || 'ダッシュボードに移動します...'}
          </p>
        </div>
      )}
      
      <SubmitButton disabled={!!clientError || !fileName} />
    </form>
  );
}
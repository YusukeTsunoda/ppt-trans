'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCSRF } from '@/hooks/useCSRF';
import { FILE_EXTENSIONS, FILE_SIZE_LIMITS } from '@/constants/mime-types';

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();
  const { csrfToken, refreshToken } = useCSRF();
  
  // ネットワーク状態の監視
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (error === 'ネットワークエラー: インターネット接続を確認してください') {
        setError('');
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setError('ネットワークエラー: インターネット接続を確認してください');
    };
    
    // 初期状態をチェック
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) {
      setError('ネットワークエラー: インターネット接続を確認してください');
    }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(''); // エラーをクリア
    
    if (selectedFile) {
      // ファイル形式のバリデーション
      const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      if (fileExtension !== '.ppt' && fileExtension !== '.pptx') {
        setError('PowerPointファイル（.ppt, .pptx）のみアップロード可能です');
        e.target.value = ''; // ファイル選択をクリア
        setFile(null);
        setFileName('');
        setFileSize(0);
        return;
      }
      
      // ファイルサイズのバリデーション
      if (selectedFile.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        setError(`ファイルサイズが大きすぎます。最大${FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}までアップロード可能です。（現在: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB）`);
        e.target.value = ''; // ファイル選択をクリア
        setFile(null);
        setFileName('');
        setFileSize(0);
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setFileSize(selectedFile.size);
    }
  };
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }
    
    if (!isOnline) {
      setError('ネットワークエラー: インターネット接続を確認してください');
      return;
    }
    
    setError('');
    setLoading(true);
    setUploadProgress(0);
    
    try {
      // Ensure we have a fresh CSRF token
      if (!csrfToken) {
        await refreshToken();
      }
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      });
      
      // Handle response
      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            reject(new Error(xhr.responseText));
          }
        };
        
        xhr.onerror = () => reject(new Error('ネットワークエラー'));
        
        xhr.open('POST', '/api/upload');
        xhr.setRequestHeader('X-CSRF-Token', csrfToken || '');
        xhr.send(formData);
      });
      
      const response = JSON.parse(xhr.responseText);
      
      if (response.success) {
        // Success - redirect to dashboard
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(response.error || 'アップロードに失敗しました');
        setLoading(false);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('ファイルのアップロードに失敗しました。もう一度お試しください。');
      setLoading(false);
      setUploadProgress(0);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6" data-testid="upload-form">
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-100">
                クリックしてファイルを選択
              </span>
              <input
                id="file-upload"
                name="file"
                type="file"
                className="sr-only"
                accept=".ppt,.pptx"
                onChange={handleFileChange}
                disabled={loading}
                data-testid="file-input"
                aria-label="PowerPointファイルを選択"
              />
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              PowerPoint (.ppt, .pptx) 最大{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}
            </p>
          </div>
        </div>
      </div>
      
      {fileName && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-900 dark:text-gray-100">
            選択されたファイル: <span className="font-medium">{fileName}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            サイズ: {(fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      )}
      
      {uploadProgress > 0 && loading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
      
      <button
        type="submit"
        disabled={loading || !file || !isOnline}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-testid="upload-button"
        aria-label={loading ? "ファイルをアップロード中" : "ファイルをアップロード"}
      >
        {loading ? (
          <>
            <svg className="inline-block mr-2 animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            アップロード中... {uploadProgress > 0 && `(${uploadProgress}%)`}
          </>
        ) : (
          'アップロード'
        )}
      </button>
    </form>
  );
}
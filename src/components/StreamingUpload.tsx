'use client';

import { useState, useCallback } from 'react';
import { 
  initStreamUpload, 
  uploadChunk, 
  completeStreamUpload,
  cancelStreamUpload 
} from '@/lib/server-actions/files/upload-stream';
import { useToast } from '@/components/Toast';

interface StreamingUploadProps {
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  maxFileSize?: number;
}

interface UploadProgress {
  uploadId?: string;
  fileName?: string;
  fileSize: number;
  uploadedBytes: number;
  progress: number;
  chunksUploaded: number;
  totalChunks: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  startTime?: number;
  estimatedTimeRemaining?: number;
  uploadSpeed?: number;
}

export function StreamingUpload({ 
  onSuccess, 
  onError,
  maxFileSize = 100 * 1024 * 1024 // 100MB
}: StreamingUploadProps) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({
    fileSize: 0,
    uploadedBytes: 0,
    progress: 0,
    chunksUploaded: 0,
    totalChunks: 0,
    status: 'idle'
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        showToast('PowerPoint (.pptx) ファイルを選択してください', 'error');
        setFile(null);
        return;
      }

      if (selectedFile.size > maxFileSize) {
        showToast(`ファイルサイズが制限（${Math.round(maxFileSize / 1024 / 1024)}MB）を超えています`, 'error');
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setProgress({
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        uploadedBytes: 0,
        progress: 0,
        chunksUploaded: 0,
        totalChunks: 0,
        status: 'idle'
      });
    }
  };

  const uploadFileInChunks = useCallback(async () => {
    if (!file) return;

    setIsUploading(true);
    const startTime = Date.now();
    
    try {
      // ストリーミングアップロードを初期化
      console.log('[StreamingUpload] Initializing upload for:', file.name);
      
      // Server ActionはFormDataと初期状態を期待
      const formData = new FormData();
      formData.append('fileName', file.name);
      formData.append('fileSize', String(file.size));
      
      const initialState = {
        success: false,
        message: '',
        timestamp: Date.now()
      };
      
      const initResult = await initStreamUpload(initialState, formData);
      
      if (!initResult.success) {
        throw new Error(initResult.message || 'アップロードの初期化に失敗しました');
      }

      const { uploadId, chunkSize, totalChunks } = initResult.data || {};
      
      setProgress(prev => ({
        ...prev,
        uploadId,
        totalChunks: totalChunks || 0,
        status: 'uploading',
        startTime
      }));

      // ファイルをチャンクに分割してアップロード
      const uploadPromises: Promise<any>[] = [];
      let uploadedBytes = 0;

      for (let i = 0; i < (totalChunks || 0); i++) {
        const start = i * (chunkSize || 1024 * 1024);
        const end = Math.min(start + (chunkSize || 1024 * 1024), file.size);
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        // チャンクを並列でアップロード（最大3並列）
        if (uploadPromises.length >= 3) {
          await Promise.race(uploadPromises);
        }

        // Server ActionはFormDataと初期状態を期待
        const chunkFormData = new FormData();
        chunkFormData.append('uploadId', uploadId!);
        chunkFormData.append('chunkIndex', String(i));
        chunkFormData.append('chunkData', new Blob([arrayBuffer]));
        
        const chunkInitialState = {
          success: false,
          message: '',
          timestamp: Date.now()
        };
        
        const uploadPromise = uploadChunk(chunkInitialState, chunkFormData)
          .then(result => {
            if (!result.success) {
              throw new Error(result.message || `チャンク ${i} のアップロードに失敗しました`);
            }

            uploadedBytes += result.data?.bytesReceived || 0;
            const currentProgress = Math.round((uploadedBytes / file.size) * 100);
            const elapsedTime = Date.now() - startTime;
            const uploadSpeed = uploadedBytes / (elapsedTime / 1000); // bytes/sec
            const remainingBytes = file.size - uploadedBytes;
            const estimatedTimeRemaining = remainingBytes / uploadSpeed * 1000; // ms

            setProgress(prev => ({
              ...prev,
              uploadedBytes,
              progress: currentProgress,
              chunksUploaded: prev.chunksUploaded + 1,
              uploadSpeed,
              estimatedTimeRemaining
            }));

            console.log(`[StreamingUpload] Chunk ${i + 1}/${totalChunks} uploaded (${currentProgress}%)`);
            
            // uploadPromises配列から完了したPromiseを削除
            const index = uploadPromises.indexOf(uploadPromise);
            if (index > -1) {
              uploadPromises.splice(index, 1);
            }
          });

        uploadPromises.push(uploadPromise);
      }

      // すべてのチャンクのアップロードを待つ
      await Promise.all(uploadPromises);

      setProgress(prev => ({
        ...prev,
        status: 'processing'
      }));

      // アップロード完了処理
      console.log('[StreamingUpload] Completing upload...');
      
      const completeFormData = new FormData();
      completeFormData.append('uploadId', uploadId!);
      
      const completeInitialState = {
        success: false,
        message: '',
        timestamp: Date.now()
      };
      
      const completeResult = await completeStreamUpload(completeInitialState, completeFormData);
      
      if (!completeResult.success) {
        throw new Error(completeResult.message || 'アップロードの完了処理に失敗しました');
      }

      setProgress(prev => ({
        ...prev,
        status: 'completed',
        progress: 100
      }));

      showToast('ファイルのアップロードが完了しました', 'success');
      
      if (onSuccess) {
        onSuccess(completeResult);
      }

    } catch (error) {
      console.error('[StreamingUpload] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      
      setProgress(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage
      }));

      showToast(errorMessage, 'error');
      
      if (onError) {
        onError(errorMessage);
      }

      // エラー時はアップロードをキャンセル
      if (progress.uploadId) {
        const cancelFormData = new FormData();
        cancelFormData.append('uploadId', progress.uploadId);
        
        const cancelInitialState = {
          success: false,
          message: '',
          timestamp: Date.now()
        };
        
        await cancelStreamUpload(cancelInitialState, cancelFormData);
      }
    } finally {
      setIsUploading(false);
    }
  }, [file, onSuccess, onError, showToast, progress.uploadId]);

  const handleCancel = async () => {
    if (progress.uploadId) {
      const cancelFormData = new FormData();
      cancelFormData.append('uploadId', progress.uploadId);
      
      const cancelInitialState = {
        success: false,
        message: '',
        timestamp: Date.now()
      };
      
      await cancelStreamUpload(cancelInitialState, cancelFormData);
      setProgress(prev => ({
        ...prev,
        status: 'cancelled'
      }));
      setIsUploading(false);
      showToast('アップロードをキャンセルしました', 'info');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間 ${minutes % 60}分`;
    } else if (minutes > 0) {
      return `${minutes}分 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
          大容量ファイル対応アップロード（ストリーミング）
        </h2>

        {/* ファイル選択 */}
        <div className="mb-6">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pptx"
            disabled={isUploading}
            className="block w-full text-sm text-slate-600 dark:text-slate-400
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-primary-50 dark:file:bg-primary-900/30 file:text-primary-700 dark:file:text-primary-300
              hover:file:bg-primary-100 dark:hover:file:bg-primary-900/50 file:transition-all file:duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {file && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              選択中: {file.name} ({formatBytes(file.size)})
            </p>
          )}
        </div>

        {/* アップロード進捗 */}
        {progress.status !== 'idle' && (
          <div className="mb-6 space-y-3">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>{progress.fileName}</span>
              <span>{progress.progress}%</span>
            </div>

            <div className="relative">
              <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                >
                  <div className="h-full bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className="font-medium">アップロード済み:</span>{' '}
                {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.fileSize)}
              </div>
              <div>
                <span className="font-medium">チャンク:</span>{' '}
                {progress.chunksUploaded} / {progress.totalChunks}
              </div>
              {progress.uploadSpeed && (
                <div>
                  <span className="font-medium">速度:</span>{' '}
                  {formatBytes(progress.uploadSpeed)}/秒
                </div>
              )}
              {progress.estimatedTimeRemaining && progress.status === 'uploading' && (
                <div>
                  <span className="font-medium">残り時間:</span>{' '}
                  {formatTime(progress.estimatedTimeRemaining)}
                </div>
              )}
            </div>

            {/* ステータスメッセージ */}
            {progress.status === 'uploading' && (
              <p className="text-sm text-primary-600 dark:text-primary-400">
                📤 ファイルをアップロード中...
              </p>
            )}
            {progress.status === 'processing' && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                ⚙️ ファイルを処理中...
              </p>
            )}
            {progress.status === 'completed' && (
              <p className="text-sm text-accent-600 dark:text-accent-400">
                ✅ アップロード完了
              </p>
            )}
            {progress.status === 'failed' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                ❌ エラー: {progress.error}
              </p>
            )}
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex gap-3">
          <button
            onClick={uploadFileInChunks}
            disabled={!file || isUploading}
            className="flex-1 px-4 py-2 text-white bg-primary-600 rounded-lg
              hover:bg-primary-700 focus:outline-none focus:ring-2
              focus:ring-offset-2 focus:ring-primary-500
              disabled:bg-slate-400 disabled:cursor-not-allowed
              transition-all duration-200 font-medium"
          >
            {isUploading ? 'アップロード中...' : 'アップロード開始'}
          </button>

          {isUploading && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg
                hover:bg-slate-300 focus:outline-none focus:ring-2
                focus:ring-offset-2 focus:ring-slate-500
                transition-all duration-200 font-medium"
            >
              キャンセル
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
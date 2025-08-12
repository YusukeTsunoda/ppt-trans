'use client';

import React, { useState } from 'react';
import { DownloadManager } from '@/lib/download/DownloadManager';
import { useToast } from '@/components/Toast';
import { generatePptx } from '@/server-actions/generate/pptx';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';

interface DownloadButtonProps {
  editedSlides: any[];
  onSuccess?: (downloadUrl: string) => void;
  onError?: (error: Error) => void;
  className?: string;
}

interface GenerationStatus {
  status: 'idle' | 'generating' | 'polling' | 'downloading' | 'completed' | 'failed';
  progress: number;
  message?: string;
  jobId?: string;
  downloadUrl?: string;
  error?: string;
}

export function DownloadButton({
  editedSlides,
  onSuccess,
  onError,
  className = ''
}: DownloadButtonProps) {
  const { showToast } = useToast();
  const [generation, setGeneration] = useState<GenerationStatus>({
    status: 'idle',
    progress: 0
  });

  // ファイルをダウンロード
  const startDownload = async (downloadUrl: string) => {
    try {
      setGeneration(prev => ({
        ...prev,
        status: 'downloading',
        message: 'ダウンロード中...'
      }));

      const result = await DownloadManager.downloadWithRetry(
        downloadUrl,
        'translated_presentation.pptx',
        {
          onProgress: (progress) => {
            setGeneration(prev => ({
              ...prev,
              progress: Math.round(progress)
            }));
          },
          onRetry: (attempt, error) => {
            logger.warn(`Download retry attempt ${attempt}`, { error });
            showToast(`ダウンロードを再試行中... (${attempt}回目)`, 'warning');
          }
        }
      );

      if (result.success && result.blob) {
        // ファイルを保存
        await DownloadManager.saveFile(result.blob, 'translated_presentation.pptx');
        
        setGeneration({
          status: 'completed',
          progress: 100,
          message: 'ダウンロード完了！'
        });

        showToast('ファイルのダウンロードが完了しました', 'success');
      } else {
        throw result.error || new Error('Download failed');
      }

    } catch (error) {
      logger.error('Download failed', error);
      
      setGeneration({
        status: 'failed',
        progress: 0,
        error: 'ダウンロードに失敗しました'
      });

      showToast('ダウンロードに失敗しました', 'error');
    }
  };

  // ファイル生成を開始
  const handleGenerateAndDownload = async () => {
    try {
      setGeneration({
        status: 'generating',
        progress: 5,
        message: 'ファイル生成を開始しています...'
      });

      // 最初のスライドから元のファイルURLを取得
      const originalFileUrl = editedSlides[0]?.originalFileUrl || '';
      if (!originalFileUrl) {
        throw new Error('元のファイルURLが見つかりません');
      }

      // Server Action用のデータを準備
      const requestData = {
        originalFileUrl,
        editedSlides: editedSlides.map((slide: any) => ({
          pageNumber: slide.pageNumber,
          texts: slide.texts.map((text: any) => ({
            id: text.id,
            original: text.original,
            translated: text.translated || text.original
          }))
        }))
      };
      
      setGeneration({
        status: 'generating',
        progress: 30,
        message: 'ファイルを生成中...'
      });

      const result = await generatePptx(requestData);
      
      if (!result.success) {
        throw new AppError(
          result.error || 'Generation failed',
          ErrorCodes.FILE_PROCESSING_FAILED,
          500
        );
      }

      // 直接ダウンロードURLが返される
      if (result.downloadUrl) {
        setGeneration({
          status: 'completed',
          progress: 100,
          message: '生成完了！',
          downloadUrl: result.downloadUrl
        });

        // ダウンロードを開始
        await startDownload(result.downloadUrl);
        if (onSuccess) {
          onSuccess(result.downloadUrl);
        }
        showToast('翻訳済みファイルの生成が完了しました', 'success');
      }

    } catch (error: any) {
      logger.error('Generation failed', error);
      
      setGeneration({
        status: 'failed',
        progress: 0,
        error: error.message || 'ファイル生成に失敗しました'
      });

      if (onError) {
        onError(error);
      }

      showToast(
        error.userMessage || error.message || 'ファイル生成に失敗しました',
        'error'
      );
    }
  };

  // キャンセル処理（現在は同期処理のためキャンセル不可）
  const handleCancel = () => {
    showToast('現在キャンセルはできません', 'warning');
  };

  // ボタンの表示内容を決定
  const getButtonContent = () => {
    switch (generation.status) {
      case 'generating':
        return (
          <>
            <span className="animate-spin mr-2">⏳</span>
            生成中... ({generation.progress}%)
          </>
        );
      case 'downloading':
        return (
          <>
            <span className="animate-pulse mr-2">⬇️</span>
            ダウンロード中... ({generation.progress}%)
          </>
        );
      case 'completed':
        return (
          <>
            <span className="mr-2">✅</span>
            完了！
          </>
        );
      case 'failed':
        return (
          <>
            <span className="mr-2">❌</span>
            失敗 - 再試行
          </>
        );
      default:
        return (
          <>
            <span className="mr-2">⬇️</span>
            翻訳済みファイルをダウンロード
          </>
        );
    }
  };

  const isProcessing = generation.status === 'generating' || 
                       generation.status === 'polling' || 
                       generation.status === 'downloading';

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={isProcessing ? handleCancel : handleGenerateAndDownload}
        disabled={generation.status === 'completed'}
        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
          isProcessing
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : generation.status === 'completed'
            ? 'bg-green-600 text-white cursor-not-allowed opacity-75'
            : generation.status === 'failed'
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        } ${className}`}
      >
        {isProcessing ? 'キャンセル' : getButtonContent()}
      </button>

      {/* プログレスバー */}
      {isProcessing && (
        <div className="w-full">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>{generation.message}</span>
            <span>{generation.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${generation.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* エラーメッセージ */}
      {generation.status === 'failed' && generation.error && (
        <div className="text-sm text-red-600 dark:text-red-400 mt-1">
          {generation.error}
        </div>
      )}
    </div>
  );
}
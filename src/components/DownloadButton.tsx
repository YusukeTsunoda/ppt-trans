'use client';

import React, { useState, useEffect } from 'react';
import { DownloadManager } from '@/lib/download/DownloadManager';
import { useToast } from '@/components/Toast';
import { generatePptx, getGenerationJobStatus } from '@/server-actions/generate/pptx';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';

interface DownloadButtonProps {
  originalFileUrl: string;
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
  originalFileUrl,
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
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // コンポーネントのクリーンアップ
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // ジョブステータスをポーリング
  const pollJobStatus = async (jobId: string) => {
    try {
      const result = await getGenerationJobStatus(jobId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get job status');
      }

      const job = result.data;

      // ステータスを更新
      setGeneration(prev => ({
        ...prev,
        progress: job.progress || prev.progress,
        message: job.message || prev.message
      }));

      // ジョブが完了した場合
      if (job.status === 'completed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        setGeneration({
          status: 'completed',
          progress: 100,
          message: '生成完了！',
          downloadUrl: job.outputFileUrl
        });

        // ダウンロードを開始
        if (job.outputFileUrl) {
          await startDownload(job.outputFileUrl);
          if (onSuccess) {
            onSuccess(job.outputFileUrl);
          }
        }

        showToast('翻訳済みファイルの生成が完了しました', 'success');
      }

      // ジョブが失敗した場合
      if (job.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        const error = new AppError(
          job.error || 'Generation failed',
          ErrorCodes.FILE_PROCESSING_FAILED,
          500
        );

        setGeneration({
          status: 'failed',
          progress: 0,
          error: job.error || 'ファイル生成に失敗しました'
        });

        if (onError) {
          onError(error);
        }

        showToast(job.error || 'ファイル生成に失敗しました', 'error');
      }

    } catch (error) {
      logger.error('Failed to poll job status', error);
      
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }

      setGeneration({
        status: 'failed',
        progress: 0,
        error: 'ステータスの取得に失敗しました'
      });

      showToast('ステータスの取得に失敗しました', 'error');
    }
  };

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

      // APIに送信するデータを準備
      const requestData = {
        originalFileUrl,
        editedSlides: editedSlides.map(slide => ({
          pageNumber: slide.pageNumber,
          texts: slide.texts.map((text: any) => ({
            id: text.id,
            original: text.original,
            translated: text.translated
          }))
        })),
        async: true // 非同期モードを使用
      };

      // Server Actionを使用してファイルを生成
      const formData = new FormData();
      formData.append('fileId', 'temp-file-id'); // TODO: 実際のfileIdを使用
      formData.append('translatedTexts', JSON.stringify(
        editedSlides.flatMap((slide: any) => 
          slide.texts.map((text: any) => ({
            slideNumber: slide.pageNumber,
            textId: text.id,
            originalText: text.original,
            translatedText: text.translated
          }))
        )
      ));
      
      const result = await generatePptx(formData);
      
      if (!result.success) {
        throw new AppError(
          result.error || 'Generation failed',
          ErrorCodes.FILE_PROCESSING_FAILED,
          500
        );
      }

      // 非同期モードの場合はジョブIDが返される
      if (result.jobId) {
        setGeneration(prev => ({
          ...prev,
          status: 'polling',
          jobId: result.jobId,
          message: 'ファイルを生成中...'
        }));

        // ステータスのポーリングを開始（2秒ごと）
        const interval = setInterval(() => {
          pollJobStatus(result.jobId);
        }, 2000);
        
        setPollingInterval(interval);

        // 初回のポーリングを即座に実行
        await pollJobStatus(result.jobId);

      } else if (result.downloadUrl) {
        // 同期モードの場合は即座にダウンロード
        await startDownload(result.downloadUrl);
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

  // ジョブをキャンセル
  const handleCancel = async () => {
    if (generation.jobId) {
      try {
        await fetch(`/api/generation-status/${generation.jobId}`, {
          method: 'DELETE'
        });

        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }

        setGeneration({
          status: 'idle',
          progress: 0
        });

        showToast('ファイル生成をキャンセルしました', 'info');
      } catch (error) {
        logger.error('Failed to cancel job', error);
      }
    }
  };

  // ボタンの表示内容を決定
  const getButtonContent = () => {
    switch (generation.status) {
      case 'generating':
      case 'polling':
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
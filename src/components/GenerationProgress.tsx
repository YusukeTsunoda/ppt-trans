'use client';

import { useEffect, useState } from 'react';
import type { JsonValue } from '@/types/common';

export interface GenerationProgressProps {
  jobId?: string;
  onComplete?: (result: JsonValue) => void;
  onError?: (error: string) => void;
}

interface ProgressState {
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  details?: string;
  error?: string;
}

export function GenerationProgress({ jobId, onComplete, onError }: GenerationProgressProps) {
  const [state, setState] = useState<ProgressState>({
    status: 'idle',
    progress: 0,
    message: '準備中...'
  });

  useEffect(() => {
    if (!jobId) return;

    let retryCount = 0;
    let currentProgress = 0;
    const maxRetries = 60; // 60秒でタイムアウト
    let intervalId: NodeJS.Timeout | null = null;

    const checkStatus = async () => {
      try {
        // Server Actionの代わりに一時的なモックデータ
        // TODO: getGenerationJobStatus Server Actionを呼び出す
        const mockProgress = Math.min(100, currentProgress + Math.random() * 20);
        currentProgress = mockProgress;
        
        if (mockProgress >= 100) {
          setState({
            status: 'completed',
            progress: 100,
            message: 'PPTXファイルの生成が完了しました！',
            details: 'ダウンロードの準備ができました'
          });
          
          if (onComplete) {
            onComplete({ downloadUrl: '/mock/download.pptx' });
          }
          
          if (intervalId) clearInterval(intervalId);
        } else {
          setState({
            status: 'processing',
            progress: mockProgress,
            message: getProgressMessage(mockProgress),
            details: getProgressDetails(mockProgress)
          });
        }
        
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error('タイムアウト: 生成処理が60秒を超えました');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '不明なエラー';
        setState({
          status: 'failed',
          progress: currentProgress,
          message: '生成に失敗しました',
          error: errorMessage
        });
        
        if (onError) {
          onError(errorMessage);
        }
        
        if (intervalId) clearInterval(intervalId);
      }
    };

    // 初回実行
    setState({
      status: 'pending',
      progress: 0,
      message: 'PPTXファイルの生成を開始しています...'
    });

    // 1秒ごとにステータスをチェック
    intervalId = setInterval(checkStatus, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const getProgressMessage = (progress: number): string => {
    if (progress < 10) return 'ファイルを読み込んでいます...';
    if (progress < 30) return 'テキストを解析しています...';
    if (progress < 50) return '翻訳内容を適用しています...';
    if (progress < 70) return 'スタイルを保持しながら変換中...';
    if (progress < 90) return 'ファイルを最適化しています...';
    return 'まもなく完了します...';
  };

  const getProgressDetails = (progress: number): string => {
    if (progress < 10) return '元のPPTXファイルを読み込んでいます';
    if (progress < 30) return 'スライドとテキスト要素を解析しています';
    if (progress < 50) return '翻訳されたテキストを各スライドに適用しています';
    if (progress < 70) return 'フォント、色、レイアウトを保持しています';
    if (progress < 90) return 'ファイルサイズを最適化しています';
    return '最終処理を実行中です';
  };

  const getStatusIcon = () => {
    switch (state.status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '⚙️';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'cancelled':
        return '🚫';
      default:
        return '📄';
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'processing':
        return 'text-primary-600 bg-primary-50 border-primary-200';
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'cancelled':
        return 'text-secondary-600 bg-secondary-50 border-secondary-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  if (state.status === 'idle' && !jobId) {
    return null;
  }

  return (
    <div className={`rounded-xl p-6 border ${getStatusColor()} transition-all duration-300`}>
      <div className="flex items-start gap-3 mb-4">
        <span className="text-2xl">{getStatusIcon()}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">{state.message}</h3>
          {state.details && (
            <p className="text-sm opacity-80">{state.details}</p>
          )}
          {state.error && (
            <p className="text-sm text-red-600 mt-2">
              エラー: {state.error}
            </p>
          )}
        </div>
        {state.progress > 0 && state.progress < 100 && (
          <span className="text-lg font-semibold">
            {Math.round(state.progress)}%
          </span>
        )}
      </div>

      {/* プログレスバー */}
      {state.status === 'processing' && (
        <div className="relative">
          <div className="w-full bg-secondary-200 rounded-full h-3 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${state.progress}%` }}
            >
              <div className="h-full bg-white/20 animate-pulse"></div>
            </div>
          </div>
          
          {/* 進捗インジケーター */}
          <div className="mt-3 flex justify-between text-xs text-secondary-500">
            <span>読み込み</span>
            <span>解析</span>
            <span>適用</span>
            <span>スタイル保持</span>
            <span>最適化</span>
            <span>完了</span>
          </div>
        </div>
      )}

      {/* アクション */}
      {state.status === 'failed' && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            再試行
          </button>
          <button
            onClick={() => setState({ ...state, status: 'idle' })}
            className="px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}
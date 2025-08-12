'use client';

import React, { useEffect, useState } from 'react';

export interface ProgressStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

interface ProgressIndicatorProps {
  current: number;
  total: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  message?: string;
  steps?: ProgressStep[];
  showDetails?: boolean;
  estimatedTimeRemaining?: number;
  className?: string;
}

export function ProgressIndicator({
  current,
  total,
  status,
  message,
  steps,
  showDetails = true,
  estimatedTimeRemaining,
  className = ''
}: ProgressIndicatorProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // プログレスバーのアニメーション
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  // ステータスに応じた色を取得
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-accent-600';
      case 'error':
        return 'bg-red-600';
      case 'processing':
        return 'bg-blue-600';
      default:
        return 'bg-gray-400';
    }
  };

  // ステップのアイコンを取得
  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⭕';
    }
  };

  // 残り時間をフォーマット
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}分`;
    } else {
      return `${Math.round(seconds / 3600)}時間`;
    }
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* メインプログレスバー */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {status === 'processing' && (
              <span className="animate-spin">⏳</span>
            )}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {message || '処理中...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {estimatedTimeRemaining && status === 'processing' && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                残り約 {formatTime(estimatedTimeRemaining)}
              </span>
            )}
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {current} / {total} ({animatedProgress}%)
            </span>
          </div>
        </div>
        
        {/* プログレスバー */}
        <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`absolute top-0 left-0 h-full ${getStatusColor()} rounded-full transition-all duration-500 ease-out`}
            style={{ width: `${animatedProgress}%` }}
          >
            {/* グラデーション効果 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>

      {/* 詳細ステップ表示 */}
      {showDetails && steps && steps.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            処理ステップ
          </h4>
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 text-sm ${
                  step.status === 'in_progress'
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : step.status === 'completed'
                    ? 'text-accent-600 dark:text-accent-400'
                    : step.status === 'failed'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="text-base">{getStepIcon(step)}</span>
                <span className="flex-1">{step.name}</span>
                {step.progress !== undefined && step.status === 'in_progress' && (
                  <span className="text-xs">({step.progress}%)</span>
                )}
                {step.message && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {step.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* エラーメッセージ */}
      {status === 'error' && message && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-red-600 dark:text-red-400">⚠️</span>
            <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
          </div>
        </div>
      )}

      {/* 成功メッセージ */}
      {status === 'completed' && (
        <div className="bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <span className="text-accent-600 dark:text-accent-400">✅</span>
            <p className="text-sm text-accent-700 dark:text-accent-300">
              処理が完了しました
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// アニメーション用のスタイル（Tailwindの@keyframesを使用）
export const progressIndicatorStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
`;
'use client';

import React from 'react';
import { AppError } from '@/lib/errors/AppError';
import { getRecoveryMessage } from '@/lib/errors/ErrorMessages';
import { isRetryableError } from '@/lib/errors/ErrorCodes';

interface ErrorMessageProps {
  error: Error | AppError | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export function ErrorMessage({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = ''
}: ErrorMessageProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // エラー情報の抽出
  type ErrorInfo = {
    message: string;
    code?: string;
    isRetryable: boolean;
    recovery?: string;
    details?: any;
  };

  const getErrorInfo = (): ErrorInfo => {
    if (typeof error === 'string') {
      return {
        message: error,
        code: undefined,
        isRetryable: false,
        recovery: undefined,
        details: undefined
      };
    }

    if (error instanceof AppError) {
      const recoveryMessage = getRecoveryMessage(error.code as any, 'ja');
      return {
        message: error.userMessage,
        code: error.code,
        isRetryable: error.isRetryable(),
        recovery: recoveryMessage || undefined,
        details: error.details
      };
    }

    return {
      message: error.message || '予期しないエラーが発生しました',
      code: undefined,
      isRetryable: false,
      recovery: undefined,
      details: undefined
    };
  };

  const errorInfo = getErrorInfo();
  const canRetry = errorInfo.isRetryable && onRetry;

  return (
    <div
      className={`rounded-lg border p-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      {/* エラーアイコンとメッセージ */}
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          {/* メインメッセージ */}
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            {errorInfo.message}
          </h3>

          {/* 復旧方法 */}
          {errorInfo.recovery ? (
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>{errorInfo.recovery}</p>
            </div>
          ) : null}

          {/* エラーコード */}
          {errorInfo.code && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              エラーコード: {errorInfo.code}
            </div>
          )}

          {/* 詳細情報（開発環境または展開時） */}
          {showDetails && errorInfo.details && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                {isExpanded ? '詳細を隠す' : '詳細を表示'}
              </button>
              
              {isExpanded && (
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(errorInfo.details, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* アクションボタン */}
          <div className="mt-4 flex gap-2">
            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
              >
                再試行
              </button>
            )}
            
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * インラインエラーメッセージ（フォームフィールド用）
 */
interface InlineErrorProps {
  error?: string;
  className?: string;
}

export function InlineError({ error, className = '' }: InlineErrorProps) {
  if (!error) return null;

  return (
    <p className={`mt-1 text-sm text-red-600 dark:text-red-400 ${className}`}>
      {error}
    </p>
  );
}

/**
 * エラーバナー（ページ全体用）
 */
interface ErrorBannerProps {
  error: Error | AppError | string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap">
          <div className="flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-red-800">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </span>
            
            <p className="ml-3 font-medium">
              {typeof error === 'string' 
                ? error 
                : error instanceof AppError 
                  ? error.userMessage 
                  : error.message}
            </p>
          </div>
          
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="bg-red-800 hover:bg-red-700 px-3 py-1 rounded text-sm transition-colors"
              >
                再試行
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-200 hover:text-white"
                aria-label="閉じる"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
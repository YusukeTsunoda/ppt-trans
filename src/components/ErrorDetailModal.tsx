'use client';

import React, { useState } from 'react';
import { AppError } from '@/lib/errors/AppError';
import { getErrorMessageObject } from '@/lib/errors/ErrorMessages';
import { ErrorCodes, type ErrorCode } from '@/lib/errors/ErrorCodes';
import { ErrorStatusMap } from '@/lib/errors/ErrorStatusMap';
import logger from '@/lib/logger';
import type { JsonObject } from '@/types/common';

interface ErrorDetailModalProps {
  error: Error | AppError;
  errorId?: string;
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onReport?: () => void;
  metadata?: Record<string, unknown>;
}

export function ErrorDetailModal({
  error,
  errorId,
  isOpen,
  onClose,
  onRetry,
  onReport,
  metadata
}: ErrorDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'details' | 'trace'>('summary');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const isAppError = error instanceof AppError;
  const errorCode = isAppError ? error.code : ErrorCodes.UNKNOWN_ERROR;
  const errorMessageObj = getErrorMessageObject(errorCode as ErrorCode);
  const statusCode = isAppError ? error.statusCode : (errorCode in ErrorStatusMap ? ErrorStatusMap[errorCode as ErrorCode] : 500);

  const handleCopyError = async () => {
    const errorInfo = {
      errorId,
      code: errorCode,
      message: error.message,
      timestamp: isAppError ? error.timestamp : new Date().toISOString(),
      metadata: isAppError ? error.metadata : metadata,
      stack: error.stack
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorInfo, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy error info', err);
    }
  };

  const handleReport = async () => {
    if (onReport) {
      onReport();
    } else {
      try {
        const reportData = {
          errorId,
          code: errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
          metadata: isAppError ? error.metadata : metadata,
          userAgent: navigator.userAgent,
          url: window.location.href
        };

        await fetch('/api/error-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData)
        });

        alert('エラーレポートを送信しました。');
      } catch (err) {
        logger.error('Failed to report error', err);
        alert('エラーレポートの送信に失敗しました。');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 dark:bg-red-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-xl font-bold">エラー詳細</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-secondary-200 dark:border-secondary-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'summary'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-200'
              }`}
            >
              概要
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-200'
              }`}
            >
              詳細情報
            </button>
            <button
              onClick={() => setActiveTab('trace')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'trace'
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-200'
              }`}
            >
              スタックトレース
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Error Message */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                  エラーメッセージ
                </h3>
                <p className="text-secondary-900 dark:text-secondary-100">
                  {errorMessageObj?.message || error.message}
                </p>
              </div>

              {/* Error Code & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                    エラーコード
                  </h3>
                  <code className="text-sm font-mono bg-secondary-100 dark:bg-secondary-900 px-2 py-1 rounded">
                    {errorCode}
                  </code>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                    HTTPステータス
                  </h3>
                  <code className="text-sm font-mono bg-secondary-100 dark:bg-secondary-900 px-2 py-1 rounded">
                    {statusCode}
                  </code>
                </div>
              </div>

              {/* Error ID */}
              {errorId && (
                <div>
                  <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                    エラーID
                  </h3>
                  <code className="text-sm font-mono bg-secondary-100 dark:bg-secondary-900 px-2 py-1 rounded">
                    {errorId}
                  </code>
                </div>
              )}

              {/* Recovery Instructions */}
              {errorMessageObj?.solution && (
                <div className="p-4 bg-primary-50 dark:bg-primary-950 rounded-lg">
                  <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-2">
                    解決方法
                  </h3>
                  <p className="text-sm text-primary-700 dark:text-primary-300">
                    {errorMessageObj.solution}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* Timestamp */}
              {isAppError && error.timestamp ? (
                <div>
                  <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                    発生時刻
                  </h3>
                  <p className="text-sm text-secondary-900 dark:text-secondary-100">
                    {new Date(error.timestamp).toLocaleString('ja-JP')}
                  </p>
                </div>
              ) : null}

              {/* Metadata */}
              {(isAppError ? error.metadata : metadata) ? (
                <div>
                  <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                    メタデータ
                  </h3>
                  <pre className="text-xs bg-secondary-100 dark:bg-secondary-900 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(isAppError ? error.metadata : metadata, null, 2)}
                  </pre>
                </div>
              ) : null}

              {/* Environment Info */}
              <div>
                <h3 className="text-sm font-semibold text-secondary-600 dark:text-secondary-400 mb-1">
                  環境情報
                </h3>
                <dl className="text-sm space-y-1">
                  <div className="flex gap-2">
                    <dt className="text-secondary-600 dark:text-secondary-400">URL:</dt>
                    <dd className="text-secondary-900 dark:text-secondary-100 truncate">
                      {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-secondary-600 dark:text-secondary-400">ブラウザ:</dt>
                    <dd className="text-secondary-900 dark:text-secondary-100 truncate">
                      {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'trace' && (
            <div>
              {error.stack ? (
                <pre className="text-xs bg-secondary-100 dark:bg-secondary-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {error.stack}
                </pre>
              ) : (
                <p className="text-secondary-600 dark:text-secondary-400">
                  スタックトレースは利用できません。
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-secondary-200 dark:border-secondary-700 p-4">
          <div className="flex justify-between items-center">
            <button
              onClick={handleCopyError}
              className="px-4 py-2 text-sm text-secondary-700 dark:text-secondary-300 hover:text-secondary-900 dark:hover:text-secondary-100 transition-colors"
            >
              {isCopied ? '✓ コピーしました' : 'エラー情報をコピー'}
            </button>
            
            <div className="flex gap-3">
              {onRetry && isAppError && error.isRetryable() && (
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  再試行
                </button>
              )}
              
              <button
                onClick={handleReport}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                エラーを報告
              </button>
              
              <button
                onClick={onClose}
                className="px-4 py-2 bg-secondary-200 dark:bg-secondary-700 text-secondary-800 dark:text-secondary-200 rounded-lg hover:bg-secondary-300 dark:hover:bg-secondary-600 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useErrorDetailModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<Error | AppError | null>(null);
  const [errorId, setErrorId] = useState<string>('');
  const [metadata, setMetadata] = useState<JsonObject | undefined>();

  const openModal = (error: Error | AppError, errorId?: string, metadata?: JsonObject) => {
    setError(error);
    setErrorId(errorId || `error-${Date.now()}`);
    setMetadata(metadata);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setTimeout(() => {
      setError(null);
      setErrorId('');
      setMetadata(undefined);
    }, 300);
  };

  return {
    isOpen,
    error,
    errorId,
    metadata,
    openModal,
    closeModal
  };
}
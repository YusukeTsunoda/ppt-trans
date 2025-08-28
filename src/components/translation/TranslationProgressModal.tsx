'use client';

import React from 'react';
import { useTranslationProgress } from '@/hooks/useTranslationProgress';

interface TranslationProgressModalProps {
  isOpen: boolean;
  fileId: string | null;
  onClose: () => void;
}

export function TranslationProgressModal({ isOpen, fileId, onClose }: TranslationProgressModalProps) {
  const { progress, isConnected, error } = useTranslationProgress(fileId);
  
  if (!isOpen) return null;

  const getStatusColor = () => {
    if (!progress) return 'bg-gray-500';
    switch (progress.status) {
      case 'preparing': return 'bg-yellow-500';
      case 'translating': return 'bg-blue-500';
      case 'finalizing': return 'bg-purple-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!progress) return '接続中...';
    switch (progress.status) {
      case 'preparing': return '準備中...';
      case 'translating': return '翻訳中...';
      case 'finalizing': return '最終処理中...';
      case 'completed': return '完了！';
      case 'failed': return 'エラーが発生しました';
      default: return '処理中...';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">翻訳進捗</h3>
          {progress?.status === 'completed' && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : (
          <>
            {/* Status */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {getStatusText()}
                </span>
                {progress && (
                  <span className="text-sm text-gray-500">
                    {progress.percentage}%
                  </span>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
                  style={{ width: `${progress?.percentage || 0}%` }}
                />
              </div>
            </div>

            {/* Details */}
            {progress && (
              <div className="space-y-2">
                {progress.current_slide && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">現在のスライド:</span>
                    <span className="font-medium">{progress.current_slide} / {progress.total_slides}</span>
                  </div>
                )}
                
                {progress.message && (
                  <div className="text-sm text-gray-600 italic">
                    {progress.message}
                  </div>
                )}

                {/* Progress visualization */}
                {progress.status === 'translating' && progress.total_slides > 0 && (
                  <div className="mt-4">
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: progress.total_slides }, (_, i) => (
                        <div
                          key={i}
                          className={`h-2 rounded-sm ${
                            i < progress.completed_slides
                              ? 'bg-green-500'
                              : i === progress.completed_slides
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-gray-200'
                          }`}
                          title={`Slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connection Status */}
            <div className="mt-4 flex items-center justify-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">
                {isConnected ? 'リアルタイム更新中' : '接続待機中'}
              </span>
            </div>

            {/* Actions */}
            {progress?.status === 'completed' && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  閉じる
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
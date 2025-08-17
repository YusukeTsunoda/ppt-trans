'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { trackError } from '@/components/Analytics';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーをSentryに送信
    Sentry.captureException(error);
    
    // Google Analyticsにエラーを記録
    trackError('app_error', error.message);
    
    // コンソールにもログ出力
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center animate-fadeIn">
      <div className="max-w-md w-full">
        <div className="card text-center">
          <div className="mb-6">
            <div className="mx-auto h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="h-12 w-12 text-red-600"
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
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            エラーが発生しました
          </h1>
          
          <p className="text-slate-600 mb-6">
            申し訳ございません。予期しないエラーが発生しました。
            問題が続く場合は、サポートまでお問い合わせください。
          </p>
          
          {error.digest && (
            <div className="mb-6 p-3 bg-slate-100 rounded-lg">
              <p className="text-sm text-slate-600">
                エラーID: <code className="font-mono text-xs">{error.digest}</code>
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={reset}
              className="btn-primary w-full"
            >
              🔄 再試行
            </button>
            
            <Link
              href="/"
              className="btn-secondary w-full block text-center"
            >
              🏠 ホームに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
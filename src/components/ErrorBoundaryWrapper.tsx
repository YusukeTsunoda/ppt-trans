'use client';

import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRouter } from 'next/navigation';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const router = useRouter();

  React.useEffect(() => {
    // Log error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to error reporting service
      fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
        }),
      }).catch(console.error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            エラーが発生しました
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            申し訳ございません。予期しないエラーが発生しました。
          </p>
          <div className="mt-4 p-4 bg-red-50 rounded-md">
            <p className="text-xs text-red-800 font-mono">
              {error.message}
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <button
              onClick={resetErrorBoundary}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              もう一度試す
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

export default function ErrorBoundaryWrapper({ 
  children, 
  fallback = ErrorFallback 
}: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      FallbackComponent={fallback}
      onReset={() => window.location.reload()}
      onError={(error, errorInfo) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error caught by boundary:', error, errorInfo);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
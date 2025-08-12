'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { getErrorMessageObject } from '@/lib/errors/ErrorMessages';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
  level?: 'page' | 'section' | 'component';
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  resetCount: number;
  previousResetKeys?: Array<string | number>;
}

/**
 * Reactコンポーネントのエラーをキャッチして処理するError Boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private previousResetKeys: Array<string | number> = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      resetCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId
    };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKeys && state.hasError) {
      const hasResetKeyChanged = props.resetKeys.some(
        (key, idx) => key !== state.previousResetKeys?.[idx]
      );
      
      if (hasResetKeyChanged && props.resetOnPropsChange) {
        return {
          hasError: false,
          error: null,
          errorInfo: null,
          errorId: '',
          resetCount: state.resetCount + 1
        };
      }
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // AppErrorに変換
    const appError = error instanceof AppError
      ? error
      : new AppError(
          error.message,
          ErrorCodes.INTERNAL_SERVER_ERROR,
          500,
          false,
          'システムエラーが発生しました',
          { originalError: error.name, componentStack: errorInfo.componentStack }
        );

    // ロガーでエラーを記録
    logger.logAppError(appError, {
      errorBoundaryLevel: this.props.level || 'component',
      errorId: this.state.errorId,
      resetCount: this.state.resetCount,
      componentStack: errorInfo.componentStack,
      isolate: this.props.isolate
    });
    
    // エラー情報を状態に保存
    this.setState({
      error: appError,
      errorInfo
    });
    
    // カスタムエラーハンドラーを呼び出し
    if (this.props.onError) {
      this.props.onError(appError, errorInfo);
    }

    // 本番環境ではエラー追跡サービスに送信
    if (process.env.NODE_ENV === 'production') {
      this.logErrorToService(appError, errorInfo);
    }

    // 自動リセット設定（開発環境のみ）
    if (process.env.NODE_ENV === 'development' && this.state.resetCount < 3) {
      this.resetTimeoutId = setTimeout(() => {
        this.handleReset();
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  logErrorToService(error: AppError, errorInfo: ErrorInfo) {
    // エラー追跡サービスへの送信を実装
    const errorData = {
      errorId: this.state.errorId,
      code: error.code,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: error.timestamp,
      metadata: error.metadata,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      level: this.props.level || 'component'
    };
    
    // 将来的にSentryやDatadogなどに送信
    logger.info('Error logged to tracking service', errorData);
  }

  handleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      resetCount: prevState.resetCount + 1
    }));
    
    logger.info('Error boundary reset', { 
      resetCount: this.state.resetCount + 1,
      level: this.props.level 
    });
  };

  private getErrorDetails() {
    const error = this.state.error;
    if (error instanceof AppError) {
      const messageObj = getErrorMessageObject(error.code as any);
      return {
        title: messageObj?.message || 'エラーが発生しました',
        description: error.userMessage || messageObj?.solution || '申し訳ございません。予期しないエラーが発生しました。',
        code: error.code,
        isRetryable: error.isRetryable(),
        recovery: messageObj?.solution
      };
    }
    
    return {
      title: 'エラーが発生しました',
      description: '申し訳ございません。予期しないエラーが発生しました。',
      code: 'UNKNOWN',
      isRetryable: true,
      recovery: null
    };
  }

  private reportError = async () => {
    try {
      const errorReport = {
        errorId: this.state.errorId,
        error: this.state.error instanceof AppError ? {
          code: this.state.error.code,
          message: this.state.error.message,
          metadata: this.state.error.metadata
        } : {
          message: this.state.error?.message,
          name: this.state.error?.name
        },
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        timestamp: new Date().toISOString()
      };
      
      // エラーレポートAPIに送信
      await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      });
      
      alert('エラーレポートを送信しました。ご協力ありがとうございます。');
    } catch (error) {
      logger.error('Failed to report error', error);
      alert('エラーレポートの送信に失敗しました。');
    }
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIが提供されている場合
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      const errorDetails = this.getErrorDetails();
      const showDetails = this.props.showDetails !== false || process.env.NODE_ENV === 'development';

      // レベルに応じたコンテナスタイル
      const containerClass = this.props.level === 'page' 
        ? 'min-h-screen bg-red-50 dark:bg-red-950 flex items-center justify-center p-4'
        : this.props.level === 'section'
        ? 'bg-red-50 dark:bg-red-950 rounded-lg p-8 my-4'
        : 'bg-red-50 dark:bg-red-950 rounded p-4';

      // デフォルトのエラーUI
      return (
        <div className={containerClass}>
          <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-12 h-12 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
                  {errorDetails.title}
                </h2>
                
                <p className="text-secondary-700 dark:text-secondary-300 mb-4">
                  {errorDetails.description}
                </p>

                {/* エラーコードとID表示 */}
                <div className="flex gap-4 text-sm text-secondary-600 dark:text-secondary-400 mb-4">
                  <span>エラーコード: <code className="font-mono">{errorDetails.code}</code></span>
                  {this.state.errorId && (
                    <span>エラーID: <code className="font-mono">{this.state.errorId}</code></span>
                  )}
                </div>

                {/* リカバリー提案 */}
                {errorDetails.recovery && (
                  <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-950 rounded-lg">
                    <h3 className="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-1">
                      解決方法:
                    </h3>
                    <p className="text-sm text-primary-700 dark:text-primary-300">
                      {errorDetails.recovery}
                    </p>
                  </div>
                )}

                {/* エラー詳細（開発環境または明示的に有効な場合） */}
                {showDetails && this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer text-sm text-secondary-600 dark:text-secondary-400 hover:text-secondary-800 dark:hover:text-secondary-200">
                      技術的な詳細を表示
                    </summary>
                    <div className="mt-2 p-4 bg-secondary-100 dark:bg-secondary-900 rounded-lg overflow-auto">
                      {this.state.error instanceof AppError && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-1">
                            メタデータ:
                          </p>
                          <pre className="text-xs text-secondary-600 dark:text-secondary-400">
                            {JSON.stringify(this.state.error.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                      <p className="text-sm font-mono text-red-600 dark:text-red-400 mb-2">
                        {this.state.error.message}
                      </p>
                      {this.state.error.stack && (
                        <pre className="text-xs text-secondary-700 dark:text-secondary-300 whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      )}
                      {this.state.errorInfo?.componentStack && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-300 mb-1">
                            Component Stack:
                          </p>
                          <pre className="text-xs text-secondary-600 dark:text-secondary-400 whitespace-pre-wrap">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-3">
                  {errorDetails.isRetryable && (
                    <button
                      onClick={this.handleReset}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={this.state.resetCount >= 3}
                    >
                      {this.state.resetCount > 0 ? `再試行 (${this.state.resetCount}/3)` : '再試行'}
                    </button>
                  )}
                  
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-2 bg-secondary-200 dark:bg-secondary-700 text-secondary-800 dark:text-secondary-200 rounded-lg hover:bg-secondary-300 dark:hover:bg-secondary-600 transition-colors duration-200"
                  >
                    ホームに戻る
                  </button>
                  
                  {process.env.NODE_ENV === 'production' && (
                    <button
                      onClick={() => this.reportError()}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                    >
                      エラーを報告
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 特定のコンポーネント用のError Boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
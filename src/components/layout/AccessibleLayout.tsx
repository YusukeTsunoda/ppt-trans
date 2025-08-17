'use client';

import React from 'react';
import Link from 'next/link';

/**
 * アクセシビリティ強化レイアウトコンポーネント
 * Phase 3: ARIAランドマークとスキップリンクの実装
 */

interface AccessibleLayoutProps {
  children: React.ReactNode;
  showSkipLinks?: boolean;
  mainId?: string;
}

export default function AccessibleLayout({ 
  children, 
  showSkipLinks = true,
  mainId = 'main-content' 
}: AccessibleLayoutProps) {
  return (
    <>
      {/* スキップリンク */}
      {showSkipLinks && (
        <div className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:shadow-lg">
          <a 
            href={`#${mainId}`}
            className="text-blue-600 underline focus:outline-2 focus:outline-blue-500"
          >
            メインコンテンツへスキップ
          </a>
        </div>
      )}

      {/* ヘッダー領域 */}
      <header role="banner" className="site-header">
        <nav role="navigation" aria-label="メインナビゲーション">
          {/* ナビゲーション内容 */}
        </nav>
      </header>

      {/* メインコンテンツ領域 */}
      <main 
        id={mainId} 
        role="main" 
        aria-label="メインコンテンツ"
        tabIndex={-1} // スキップリンクのターゲット用
      >
        {children}
      </main>

      {/* フッター領域 */}
      <footer role="contentinfo" aria-label="サイト情報">
        {/* フッター内容 */}
      </footer>
    </>
  );
}

/**
 * アクセシブルなフォームラッパー
 */
export function AccessibleForm({ 
  children, 
  formLabel,
  onSubmit,
  ...props 
}: {
  children: React.ReactNode;
  formLabel: string;
  onSubmit?: (e: React.FormEvent) => void;
  [key: string]: any;
}) {
  return (
    <form 
      role="form"
      aria-label={formLabel}
      onSubmit={onSubmit}
      {...props}
    >
      <fieldset>
        <legend className="sr-only">{formLabel}</legend>
        {children}
      </fieldset>
    </form>
  );
}

/**
 * アクセシブルなボタンコンポーネント
 */
export function AccessibleButton({
  children,
  ariaLabel,
  isLoading = false,
  loadingText = '処理中...',
  ...props
}: {
  children: React.ReactNode;
  ariaLabel?: string;
  isLoading?: boolean;
  loadingText?: string;
  [key: string]: any;
}) {
  return (
    <button
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={isLoading}
      aria-disabled={props.disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="sr-only">{loadingText}</span>
          <span aria-hidden="true">
            {/* ローディングインジケーター */}
            <svg className="animate-spin h-5 w-5 inline mr-2" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            {loadingText}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * アクセシブルなアラートコンポーネント
 */
export function AccessibleAlert({
  type = 'info',
  children,
  isLive = true,
  politeness = 'polite'
}: {
  type?: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  isLive?: boolean;
  politeness?: 'polite' | 'assertive';
}) {
  const roleMap = {
    info: 'status',
    success: 'status',
    warning: 'alert',
    error: 'alert'
  };

  const classMap = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200'
  };

  return (
    <div
      role={roleMap[type]}
      aria-live={isLive ? politeness : undefined}
      aria-atomic="true"
      className={`p-4 rounded-md border ${classMap[type]}`}
    >
      {children}
    </div>
  );
}

/**
 * アクセシブルなモーダルコンポーネント
 */
export function AccessibleModal({
  isOpen,
  onClose,
  title,
  children,
  modalId = 'modal'
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  modalId?: string;
}) {
  // Escapeキーでモーダルを閉じる
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // フォーカストラップ
  React.useEffect(() => {
    if (!isOpen) return;

    const modal = document.getElementById(modalId);
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // 初期フォーカス
    firstElement?.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen, modalId]);

  if (!isOpen) return null;

  return (
    <>
      {/* バックドロップ */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* モーダル本体 */}
      <div
        id={modalId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* ヘッダー */}
          <div className="flex justify-between items-center mb-4">
            <h2 id={`${modalId}-title`} className="text-xl font-semibold">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="モーダルを閉じる"
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* コンテンツ */}
          <div>{children}</div>
        </div>
      </div>
    </>
  );
}

/**
 * スクリーンリーダー専用テキスト
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/**
 * ARIAライブリージョン
 */
export function LiveRegion({ 
  message, 
  politeness = 'polite' 
}: { 
  message: string;
  politeness?: 'polite' | 'assertive' | 'off';
}) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
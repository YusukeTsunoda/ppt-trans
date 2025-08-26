'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import type { JsonObject } from '@/types/common';

declare global {
  interface Window {
    gtag: (
      command: string,
      targetId: string,
      config?: JsonObject
    ) => void;
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    
    // ページビューを記録
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  if (!GA_MEASUREMENT_ID) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
            cookie_flags: 'SameSite=None;Secure',
          });
        `}
      </Script>
    </>
  );
}

// イベントトラッキング用のヘルパー関数
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (!GA_MEASUREMENT_ID || typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

// ファイルアップロードイベント
export function trackFileUpload(fileType: string, fileSize: number) {
  trackEvent('file_upload', 'engagement', fileType, Math.round(fileSize / 1024));
}

// 翻訳完了イベント
export function trackTranslation(slideCount: number, duration: number) {
  trackEvent('translation_complete', 'conversion', `slides_${slideCount}`, duration);
}

// エラーイベント
export function trackError(errorType: string, errorMessage: string) {
  trackEvent('error', 'error', `${errorType}: ${errorMessage}`);
}

// ユーザー登録イベント
export function trackSignUp(method: string) {
  trackEvent('sign_up', 'acquisition', method);
}

// ログインイベント
export function trackLogin(method: string) {
  trackEvent('login', 'engagement', method);
}
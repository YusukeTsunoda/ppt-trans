import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // パフォーマンスモニタリング
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // 環境設定
    environment: process.env.NODE_ENV,
    
    // デバッグモード（開発環境のみ）
    debug: process.env.NODE_ENV === 'development',
    
    // エラーフィルタリング
    beforeSend(event) {
      // 開発環境では送信しない
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      
      return event;
    },
    
    // 初期スコープ
    initialScope: {
      tags: {
        component: 'edge',
        runtime: 'edge',
      },
    },
  });
}
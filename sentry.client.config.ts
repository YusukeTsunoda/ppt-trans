import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // パフォーマンスモニタリング
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // セッションリプレイ
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // 環境設定
    environment: process.env.NODE_ENV,
    
    // デバッグモード（開発環境のみ）
    debug: process.env.NODE_ENV === 'development',
    
    // インテグレーション
    integrations: [
      // Sentry v8+ では自動設定されるため、以下の設定は不要
      // 必要に応じて以下のように設定可能:
      // Sentry.browserTracingIntegration(),
      // Sentry.replayIntegration({ maskAllText: true, blockAllMedia: false }),
    ],
    
    // エラーフィルタリング
    beforeSend(event, hint) {
      // 開発環境では全てのエラーを送信
      if (process.env.NODE_ENV === 'development') {
        console.log('Sentry Event:', event);
        return null; // 開発環境では送信しない
      }
      
      // 特定のエラーを無視
      const error = hint.originalException;
      if (error && error instanceof Error) {
        // ネットワークエラーは無視
        if (error.message?.includes('NetworkError')) {
          return null;
        }
        // キャンセルされたリクエストは無視
        if (error.message?.includes('AbortError')) {
          return null;
        }
      }
      
      // 特定のURLからのエラーは無視
      if (event.request?.url?.includes('chrome-extension://')) {
        return null;
      }
      
      return event;
    },
    
    // ユーザー情報の追加
    initialScope: {
      tags: {
        component: 'frontend',
      },
    },
  });
}
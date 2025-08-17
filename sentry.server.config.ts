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
    beforeSend(event, hint) {
      // 開発環境では全てのエラーを送信しない
      if (process.env.NODE_ENV === 'development') {
        console.log('Sentry Server Event:', event);
        return null;
      }
      
      // 404エラーは無視
      if (event.exception?.values?.[0]?.value?.includes('404')) {
        return null;
      }
      
      return event;
    },
    
    // インテグレーション
    integrations: [
      // Sentry v8+ では自動設定されるため、以下の設定は不要
      // 必要に応じて以下のように設定可能:
      // Sentry.httpIntegration({ tracing: true }),
      // Prismaクエリ追跡（使用する場合）
      // Sentry.prismaIntegration({ client: prisma }),
    ],
    
    // 初期スコープ
    initialScope: {
      tags: {
        component: 'backend',
        runtime: 'node',
      },
    },
  });
}
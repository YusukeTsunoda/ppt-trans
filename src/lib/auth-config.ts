/**
 * NextAuth動的設定ユーティリティ
 * 複数ポート対応のための動的URL生成
 */

export function getNextAuthUrl(): string {
  // クライアントサイド
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // サーバーサイド - 環境変数から取得
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }
  
  // ポート番号を動的に検出
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

export function getTrustedHosts(): string[] {
  const hosts = [
    'localhost:3000',
    'localhost:3001', 
    'localhost:3002',
    '127.0.0.1:3000',
    '127.0.0.1:3001',
    '127.0.0.1:3002',
  ];
  
  // 開発環境では追加のホストを許可
  if (process.env.NODE_ENV === 'development') {
    hosts.push('localhost', '127.0.0.1');
  }
  
  return hosts;
}

export function shouldTrustHost(): boolean {
  // 開発環境では常にtrue
  if (process.env.NODE_ENV === 'development') {
    return true;
  }
  
  // 本番環境では環境変数で制御
  return process.env.AUTH_TRUST_HOST === 'true';
}
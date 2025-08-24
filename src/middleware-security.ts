import { NextResponse, type NextRequest } from 'next/server';

/**
 * セキュリティヘッダーの包括的な実装
 * helmetの削除に伴い、すべてのセキュリティヘッダーを明示的に設定
 */

// セキュリティヘッダーの定義（helmetの代替）
export const SECURITY_HEADERS = {
  // Content Security Policy（既存のCSPを拡張）
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.googletagmanager.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' data: https: blob:;
    font-src 'self' data: https://fonts.gstatic.com;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://www.google-analytics.com;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
    block-all-mixed-content;
  `.replace(/\s{2,}/g, ' ').trim(),
  
  // Helmetが提供していたヘッダー
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '0', // モダンブラウザでは無効化推奨
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  
  // HSTS（本番環境のみ）
  ...(process.env.NODE_ENV === 'production' ? {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  } : {}),
};

/**
 * レート制限の設定（express-rate-limitの代替）
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  api: {
    windowMs: 15 * 60 * 1000, // 15分
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  },
  auth: {
    windowMs: 15 * 60 * 1000,
    max: 5, // 認証は厳しく制限
    standardHeaders: true,
    legacyHeaders: false,
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  },
  translate: {
    windowMs: 60 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
  },
};

/**
 * CSRF保護の実装（csrfライブラリの代替）
 */
export function validateCSRFToken(request: NextRequest): boolean {
  // Double Submit Cookie パターンの実装
  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfCookie = request.cookies.get('csrf-token')?.value;
  
  if (!csrfHeader || !csrfCookie) {
    return false;
  }
  
  // タイミング攻撃を防ぐための定時間比較
  return timingSafeEqual(csrfHeader, csrfCookie);
}

/**
 * タイミング攻撃を防ぐ定時間文字列比較
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * セキュリティヘッダーを適用
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

/**
 * リクエストの検証
 */
export function validateRequest(request: NextRequest): {
  valid: boolean;
  reason?: string;
} {
  // User-Agentの検証
  const userAgent = request.headers.get('user-agent');
  if (!userAgent || userAgent.length < 10) {
    return { valid: false, reason: 'Invalid user agent' };
  }
  
  // Refererの検証（必要に応じて）
  const referer = request.headers.get('referer');
  if (referer && !isValidReferer(referer)) {
    return { valid: false, reason: 'Invalid referer' };
  }
  
  // Content-Typeの検証（POST/PUTリクエストの場合）
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (!contentType) {
      return { valid: false, reason: 'Missing content-type' };
    }
  }
  
  return { valid: true };
}

/**
 * 有効なRefererかチェック
 */
function isValidReferer(referer: string): boolean {
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);
  
  return allowedOrigins.some(origin => referer.startsWith(origin!));
}

/**
 * IPアドレスベースのレート制限用ストレージ
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * IPアドレスベースのレート制限チェック
 */
export function checkRateLimit(
  ip: string,
  endpoint: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || record.resetTime < now) {
    // 新しいウィンドウを開始
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.max - 1, resetTime };
  }
  
  if (record.count >= config.max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }
  
  record.count++;
  return { allowed: true, remaining: config.max - record.count, resetTime: record.resetTime };
}

/**
 * 定期的なクリーンアップ（メモリリーク防止）
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000); // 1分ごと
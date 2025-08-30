import { NextRequest, NextResponse } from 'next/server';
import { CSRFProtection } from './csrf';
import { OriginValidator } from './origin-validator';
import { rateLimiter, RateLimitConfig } from './advanced-rate-limiter';
import { CSRFTokenRotation } from './token-rotation';
import { SecurityMonitor } from './security-monitor';
import logger from '@/lib/logger';

export interface SecurityCheckOptions {
  csrf?: boolean;
  origin?: boolean;
  rateLimit?: RateLimitConfig | false;
  contentType?: string | string[];
  methods?: string[];
  skipInE2E?: boolean; // E2Eテスト時にスキップする項目
}

export interface SecurityCheckResult {
  success: boolean;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  requestId: string;
  rateLimitResult?: {
    allowed: boolean;
    remaining?: number;
    limit?: number;
    retryAfter?: number;
  };
}

/**
 * 統合セキュリティチェック関数
 * API Routes で共通のセキュリティチェックを実行
 */
export async function performSecurityChecks(
  request: NextRequest,
  options: SecurityCheckOptions = {}
): Promise<SecurityCheckResult> {
  const requestId = crypto.randomUUID();
  const {
    csrf = true,
    origin = true,
    rateLimit = false,
    contentType = 'application/json',
    methods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    skipInE2E = true,
  } = options;
  
  // E2Eテストモード検出
  const isE2ETest = request.headers.get('X-E2E-Test') === 'true';
  const isTestEnv = process.env.NODE_ENV === 'test';
  
  // セキュリティモニター取得とIP情報
  const monitor = SecurityMonitor.getInstance();
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // IPブロックチェック
  if (monitor.isIPBlocked(clientIP)) {
    logger.warn('Blocked IP attempted access', { 
      requestId,
      ip: clientIP,
      path: request.url,
    });
    
    await monitor.logEvent({
      type: 'suspicious_activity',
      severity: 'high',
      details: { reason: 'blocked_ip_attempt' },
      requestId,
      ip: clientIP,
      userAgent,
      path: request.url,
      method: request.method,
    });
    
    return {
      success: false,
      error: 'アクセスが拒否されました',
      status: 403,
      requestId,
    };
  }

  // メソッドチェック
  if (methods.length > 0 && !methods.includes(request.method)) {
    logger.warn('Method not allowed', { 
      requestId,
      method: request.method,
      allowed: methods 
    });
    
    return {
      success: false,
      error: 'メソッドが許可されていません',
      status: 405,
      headers: {
        'Allow': methods.join(', '),
      },
      requestId,
    };
  }

  // 1. レート制限チェック（E2Eテスト時は緩和）
  let rateLimitResult;
  if (rateLimit && !(skipInE2E && (isE2ETest || isTestEnv))) {
    rateLimitResult = await rateLimiter.check(request, rateLimit);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', { 
        requestId,
        ip: clientIP,
      });
      
      // セキュリティイベントログ
      await monitor.logEvent({
        type: 'rate_limit',
        severity: 'medium',
        details: {
          limit: rateLimitResult.limit,
          retryAfter: rateLimitResult.retryAfter,
          endpoint: request.url,
        },
        requestId,
        ip: clientIP,
        userAgent,
        path: request.url,
        method: request.method,
      });
      
      return {
        success: false,
        error: 'リクエストが多すぎます。しばらくお待ちください。',
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Limit': String(rateLimitResult.limit || 5),
        },
        requestId,
        rateLimitResult,
      };
    }
  }

  // 2. Origin/Referer検証（E2Eテスト時はスキップ可能）
  if (origin && !(skipInE2E && (isE2ETest || isTestEnv)) && !OriginValidator.validate(request)) {
    logger.error('Invalid origin', { 
      requestId,
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    });
    
    // セキュリティイベントログ
    await monitor.logEvent({
      type: 'origin_violation',
      severity: 'high',
      details: {
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
        expected: process.env.NEXT_PUBLIC_APP_URL,
      },
      requestId,
      ip: clientIP,
      userAgent,
      path: request.url,
      method: request.method,
    });
    
    return {
      success: false,
      error: '不正なリクエストです',
      status: 403,
      requestId,
    };
  }

  // 3. CSRF検証（GET/HEAD/OPTIONS以外）
  if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    // まずトークンローテーションの検証を試みる
    const rotation = CSRFTokenRotation.getInstance();
    const token = request.cookies.get('csrf-token')?.value || 
                 request.cookies.get('csrf-token-meta')?.value || '';
    
    let isValid = false;
    
    // トークンローテーションでの検証
    if (token && rotation.validateWithRotation(token)) {
      isValid = true;
      logger.debug('CSRF token validated through rotation system', { requestId });
    } else {
      // 従来の検証にフォールバック
      isValid = await CSRFProtection.verifyToken(request);
    }
    
    if (!isValid) {
      logger.error('CSRF validation failed', { 
        requestId,
        path: request.url,
        method: request.method,
      });
      
      // セキュリティイベントログ
      await monitor.logEvent({
        type: 'csrf_failure',
        severity: 'high',
        details: {
          tokenPresent: !!token,
          rotationValidation: false,
          fallbackValidation: false,
        },
        requestId,
        ip: clientIP,
        userAgent,
        path: request.url,
        method: request.method,
      });
      
      return {
        success: false,
        error: 'セキュリティトークンが無効です',
        status: 403,
        requestId,
      };
    }
  }

  // 4. Content-Type検証（POST/PUT/PATCHの場合）
  if (contentType && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const actualContentType = request.headers.get('content-type');
    const allowedTypes = Array.isArray(contentType) ? contentType : [contentType];
    
    const isValidContentType = allowedTypes.some(type => 
      actualContentType?.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isValidContentType) {
      logger.warn('Invalid content type', { 
        requestId,
        actual: actualContentType,
        expected: allowedTypes,
      });
      
      // セキュリティイベントログ
      await monitor.logEvent({
        type: 'content_type_violation',
        severity: 'medium',
        details: {
          actual: actualContentType,
          expected: allowedTypes,
        },
        requestId,
        ip: clientIP,
        userAgent,
        path: request.url,
        method: request.method,
      });
      
      return {
        success: false,
        error: '不正なContent-Type',
        status: 400,
        requestId,
      };
    }
  }

  // すべてのチェックをパス
  return {
    success: true,
    requestId,
    rateLimitResult,
  };
}

/**
 * セキュリティヘッダーを追加
 */
export function addSecurityHeaders(
  response: NextResponse,
  requestId?: string
): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  
  if (requestId) {
    response.headers.set('X-Request-Id', requestId);
  }
  
  return response;
}

/**
 * エラーレスポンスを生成
 */
export function createErrorResponse(
  error: string,
  status: number,
  headers?: Record<string, string>,
  requestId?: string
): NextResponse {
  const response = NextResponse.json(
    { 
      error,
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status }
  );

  // カスタムヘッダーを追加
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // セキュリティヘッダーを追加
  return addSecurityHeaders(response, requestId);
}

/**
 * 成功レスポンスを生成
 */
export function createSuccessResponse(
  data: any,
  status: number = 200,
  requestId?: string
): NextResponse {
  const response = NextResponse.json(data, { status });
  return addSecurityHeaders(response, requestId);
}
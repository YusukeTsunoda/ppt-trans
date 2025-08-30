/**
 * 管理者ルート専用のレート制限設定
 */

import { AdvancedRateLimiter, RateLimitConfig } from './advanced-rate-limiter';
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

// 管理者APIのレート制限設定
const ADMIN_RATE_LIMITS = {
  // 統計情報取得
  stats: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 30,
    message: 'Too many stats requests. Please wait before trying again.',
  },
  // データエクスポート
  export: {
    windowMs: 5 * 60 * 1000, // 5分
    maxRequests: 5,
    message: 'Export rate limit exceeded. Please wait 5 minutes.',
  },
  // ユーザー管理操作
  userManagement: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 10,
    message: 'Too many user management operations. Please slow down.',
  },
  // システム設定変更
  systemConfig: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 5,
    message: 'System configuration rate limit exceeded.',
  },
  // デフォルト（その他の管理者ルート）
  default: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 20,
    message: 'Admin API rate limit exceeded. Please try again later.',
  }
};

// レート制限インスタンス
const rateLimiter = new AdvancedRateLimiter();

/**
 * 管理者ルートのレート制限チェック
 */
export async function checkAdminRateLimit(
  request: NextRequest,
  routeType: keyof typeof ADMIN_RATE_LIMITS = 'default'
): Promise<{ allowed: boolean; response?: NextResponse }> {
  try {
    const config = ADMIN_RATE_LIMITS[routeType];
    const rateLimitConfig: RateLimitConfig = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      identifier: `admin_${routeType}`,
    };
    
    const result = await rateLimiter.check(request, rateLimitConfig);
    
    if (!result.allowed) {
      logger.warn('Admin rate limit exceeded', {
        routeType,
        path: request.nextUrl.pathname,
        remaining: result.remaining,
        resetTime: result.resetTime,
      });
      
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: config.message,
          retryAfter: result.retryAfter,
        },
        { status: 429 }
      );
      
      // Rate limit headers
      if (result.limit) {
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
      }
      if (result.remaining !== undefined) {
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      }
      if (result.resetTime) {
        response.headers.set('X-RateLimit-Reset', result.resetTime.toISOString());
      }
      if (result.retryAfter) {
        response.headers.set('Retry-After', result.retryAfter.toString());
      }
      
      return { allowed: false, response };
    }
    
    return { allowed: true };
  } catch (error) {
    logger.error('Error checking admin rate limit', { error });
    // エラーの場合はリクエストを通す（フェイルオープン）
    return { allowed: true };
  }
}

/**
 * 管理者ルート用のミドルウェアヘルパー
 */
export function withAdminRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  routeType: keyof typeof ADMIN_RATE_LIMITS = 'default'
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { allowed, response } = await checkAdminRateLimit(req, routeType);
    
    if (!allowed && response) {
      return response;
    }
    
    return handler(req);
  };
}

/**
 * ルートパスから適切なレート制限タイプを判定
 */
export function getRouteType(pathname: string): keyof typeof ADMIN_RATE_LIMITS {
  if (pathname.includes('/api/admin/stats') || pathname.includes('/api/security/stats')) {
    return 'stats';
  }
  if (pathname.includes('/api/admin/export')) {
    return 'export';
  }
  if (pathname.includes('/api/admin/users')) {
    return 'userManagement';
  }
  if (pathname.includes('/api/admin/config') || pathname.includes('/api/admin/settings')) {
    return 'systemConfig';
  }
  return 'default';
}
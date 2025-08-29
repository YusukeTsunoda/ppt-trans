import { LRUCache } from 'lru-cache';
import { NextRequest, NextResponse } from 'next/server';

export type RateLimitConfig = {
  interval: number; // ミリ秒
  uniqueTokenPerInterval: number; // インターバルごとのユニークトークン数
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
};

// デフォルトのレート制限設定
export const defaultRateLimitConfig: Record<string, RateLimitConfig> = {
  api: {
    interval: 60 * 1000, // 1分
    uniqueTokenPerInterval: 500, // 1分あたり最大500リクエスト
  },
  auth: {
    interval: 15 * 60 * 1000, // 15分
    uniqueTokenPerInterval: 10, // 15分あたり最大10回の認証試行
  },
  translate: {
    interval: 60 * 60 * 1000, // 1時間
    uniqueTokenPerInterval: 50, // 1時間あたり最大50回の翻訳
  },
  upload: {
    interval: 60 * 60 * 1000, // 1時間
    uniqueTokenPerInterval: 20, // 1時間あたり最大20ファイル
  },
};

export class RateLimiter {
  private cache: LRUCache<string, number[]>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cache = new LRUCache<string, number[]>({
      max: config.uniqueTokenPerInterval,
      ttl: config.interval,
    });
  }

  /**
   * レート制限をチェック
   */
  check(token: string, limit: number = 10): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.interval;
    
    // 現在のトークンのリクエスト履歴を取得
    const requests = this.cache.get(token) || [];
    
    // ウィンドウ内のリクエストのみを保持
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // レート制限チェック
    if (recentRequests.length >= limit) {
      const oldestRequest = Math.min(...recentRequests);
      const reset = new Date(oldestRequest + this.config.interval);
      
      return {
        success: false,
        limit,
        remaining: 0,
        reset,
      };
    }
    
    // 新しいリクエストを記録
    recentRequests.push(now);
    this.cache.set(token, recentRequests);
    
    return {
      success: true,
      limit,
      remaining: limit - recentRequests.length,
      reset: new Date(now + this.config.interval),
    };
  }
}

// グローバルなレート制限インスタンス
const rateLimiters: Record<string, RateLimiter> = {};

/**
 * レート制限を適用
 */
export async function withRateLimit(
  request: NextRequest,
  limiterName: string = 'api',
  limit: number = 10
): Promise<RateLimitResult | null> {
  // レート制限を無効化する環境変数チェック
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    return null;
  }
  
  // レート制限インスタンスを取得または作成
  if (!rateLimiters[limiterName]) {
    const config = defaultRateLimitConfig[limiterName] || defaultRateLimitConfig.api;
    rateLimiters[limiterName] = new RateLimiter(config);
  }
  
  // クライアントIPアドレスを取得
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  // レート制限チェック
  const result = rateLimiters[limiterName].check(ip, limit);
  
  if (!result.success) {
    return result;
  }
  
  return null;
}

/**
 * レート制限エラーレスポンスを作成
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((result.reset.getTime() - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toISOString(),
        'Retry-After': Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString(),
      },
    }
  );
}
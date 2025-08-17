import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

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
  async check(
    identifier: string,
    limit: number = 10
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.interval;

    // 現在のウィンドウ内のリクエストを取得
    const requests = this.cache.get(identifier) || [];
    const recentRequests = requests.filter((timestamp) => timestamp > windowStart);

    // リクエスト数が制限を超えているかチェック
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
    this.cache.set(identifier, recentRequests);

    return {
      success: true,
      limit,
      remaining: limit - recentRequests.length,
      reset: new Date(now + this.config.interval),
    };
  }

  /**
   * 識別子のレート制限をリセット
   */
  reset(identifier: string): void {
    this.cache.delete(identifier);
  }
}

// グローバルレートリミッターインスタンス
const rateLimiters = new Map<string, RateLimiter>();

/**
 * レートリミッターを取得または作成
 */
export function getRateLimiter(
  name: string,
  config?: RateLimitConfig
): RateLimiter {
  if (!rateLimiters.has(name)) {
    const limiterConfig = config || defaultRateLimitConfig[name] || defaultRateLimitConfig.api;
    rateLimiters.set(name, new RateLimiter(limiterConfig));
  }
  return rateLimiters.get(name)!;
}

/**
 * リクエストから識別子を取得
 */
export function getIdentifier(request: NextRequest): string {
  // 優先順位: ユーザーID > セッションID > IPアドレス
  const userId = request.headers.get('x-user-id');
  if (userId) return `user:${userId}`;

  const sessionId = request.cookies.get('session-id')?.value;
  if (sessionId) return `session:${sessionId}`;

  // IPアドレスを取得（プロキシ経由の場合も考慮）
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * レート制限ミドルウェアヘルパー
 */
export async function withRateLimit(
  request: NextRequest,
  limiterName: string,
  limit?: number
): Promise<RateLimitResult | null> {
  // レート制限が無効な場合
  if (process.env.ENABLE_RATE_LIMITING === 'false') {
    return null;
  }

  const limiter = getRateLimiter(limiterName);
  const identifier = getIdentifier(request);
  const result = await limiter.check(identifier, limit);

  // レスポンスヘッダーに制限情報を追加
  if (!result.success) {
    return result;
  }

  return null;
}

/**
 * レート制限エラーレスポンスを作成
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.reset.getTime() - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset.toISOString(),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.reset.toISOString(),
        'Retry-After': retryAfter.toString(),
      },
    }
  );
}
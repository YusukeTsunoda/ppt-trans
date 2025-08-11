import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/queue/config';
import logger from '@/lib/logger';

interface RateLimitConfig {
  windowMs: number; // 時間窓（ミリ秒）
  max: number; // 最大リクエスト数
  message?: string; // エラーメッセージ
  standardHeaders?: boolean; // RateLimit ヘッダーを返す
  legacyHeaders?: boolean; // X-RateLimit ヘッダーを返す
  skipSuccessfulRequests?: boolean; // 成功リクエストをカウントしない
  skipFailedRequests?: boolean; // 失敗リクエストをカウントしない
  keyGenerator?: (req: NextRequest) => string; // キー生成関数
}

export class RateLimiter {
  private config: RateLimitConfig;
  private redis = getRedisClient();

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
  }

  /**
   * IPアドレスを取得
   */
  private getIpAddress(req: NextRequest): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const real = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || real || 'unknown';
    return ip.trim();
  }

  /**
   * レート制限キーを生成
   */
  private generateKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }
    
    const ip = this.getIpAddress(req);
    const path = new URL(req.url).pathname;
    return `ratelimit:${path}:${ip}`;
  }

  /**
   * レート制限をチェック
   */
  async check(req: NextRequest): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: Date;
    response?: NextResponse;
  }> {
    const key = this.generateKey(req);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    try {
      // Redisトランザクションで原子的に処理
      const multi = this.redis.multi();
      
      // 古いエントリを削除
      multi.zremrangebyscore(key, '-inf', windowStart);
      
      // 現在のカウントを取得
      multi.zcard(key);
      
      // 新しいリクエストを追加
      multi.zadd(key, now, `${now}-${Math.random()}`);
      
      // TTLを設定
      multi.expire(key, Math.ceil(this.config.windowMs / 1000));
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis transaction failed');
      }
      
      const count = (results[1][1] as number) + 1;
      const remaining = Math.max(0, this.config.max - count);
      const resetTime = new Date(now + this.config.windowMs);
      
      // レート制限を超えている場合
      if (count > this.config.max) {
        // 余分なリクエストを削除
        await this.redis.zremrangebyrank(key, 0, 0);
        
        logger.warn('Rate limit exceeded', {
          key,
          count,
          limit: this.config.max,
          ip: this.getIpAddress(req),
        });
        
        const response = NextResponse.json(
          { 
            error: this.config.message,
            retryAfter: Math.ceil(this.config.windowMs / 1000),
          },
          { status: 429 }
        );
        
        // ヘッダーを設定
        this.setHeaders(response, {
          limit: this.config.max,
          remaining: 0,
          reset: resetTime,
        });
        
        return {
          success: false,
          limit: this.config.max,
          remaining: 0,
          reset: resetTime,
          response,
        };
      }
      
      return {
        success: true,
        limit: this.config.max,
        remaining,
        reset: resetTime,
      };
      
    } catch (error) {
      logger.error('Rate limiter error', error);
      
      // エラー時は通過させる（フェイルオープン）
      return {
        success: true,
        limit: this.config.max,
        remaining: this.config.max,
        reset: new Date(now + this.config.windowMs),
      };
    }
  }

  /**
   * レート制限ヘッダーを設定
   */
  private setHeaders(
    response: NextResponse,
    info: { limit: number; remaining: number; reset: Date }
  ) {
    if (this.config.standardHeaders) {
      response.headers.set('RateLimit-Limit', info.limit.toString());
      response.headers.set('RateLimit-Remaining', info.remaining.toString());
      response.headers.set('RateLimit-Reset', info.reset.toISOString());
    }
    
    if (this.config.legacyHeaders) {
      response.headers.set('X-RateLimit-Limit', info.limit.toString());
      response.headers.set('X-RateLimit-Remaining', info.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.floor(info.reset.getTime() / 1000).toString());
    }
    
    if (info.remaining === 0) {
      response.headers.set('Retry-After', Math.ceil(this.config.windowMs / 1000).toString());
    }
  }
}

// プリセット設定
export const rateLimiters = {
  // 一般的なAPI（1分間に60リクエスト）
  general: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    max: 60,
  }),
  
  // 認証API（5分間に5回）
  auth: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5分
    max: 5,
    message: 'Too many authentication attempts, please try again later.',
  }),
  
  // ファイルアップロード（1分間に10回）
  upload: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    max: 10,
    message: 'Too many file uploads, please try again later.',
  }),
  
  // 翻訳API（1分間に30回）
  translate: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    max: 30,
    message: 'Translation rate limit exceeded, please try again later.',
  }),
  
  // 管理者API（1分間に100回）
  admin: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    max: 100,
  }),
};

// ミドルウェアヘルパー関数
export async function withRateLimit(
  req: NextRequest,
  rateLimiter: RateLimiter = rateLimiters.general
): Promise<NextResponse | null> {
  const result = await rateLimiter.check(req);
  
  if (!result.success && result.response) {
    return result.response;
  }
  
  return null;
}
import { LRUCache } from 'lru-cache';
import { NextRequest } from 'next/server';

export interface RateLimitConfig {
  windowMs: number;  // 時間窓（ミリ秒）
  max?: number;       // 最大リクエスト数（maxRequestsでも受け入れる）
  maxRequests?: number; // 最大リクエスト数（エイリアス）
  skipSuccessfulRequests?: boolean; // 成功したリクエストをカウントしない
  keyGenerator?: (req: NextRequest) => string;
  message?: string;  // カスタムエラーメッセージ
  identifier?: string; // 識別子（カスタムキー生成用）
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remaining?: number;
  limit?: number;
  resetTime?: Date;
}

export class AdvancedRateLimiter {
  private cache: LRUCache<string, number[]>;
  
  constructor() {
    this.cache = new LRUCache({
      max: 10000, // 最大10000個のIPアドレスを追跡
      ttl: 60 * 60 * 1000, // 1時間でエントリを削除
    });
  }

  /**
   * レート制限チェック（スライディングウィンドウ方式）
   */
  async check(req: NextRequest, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = config.keyGenerator ? 
      config.keyGenerator(req) : 
      (config.identifier ? `${config.identifier}:${this.getClientIdentifier(req)}` : this.getClientIdentifier(req));
    
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // maxRequestsとmaxの両方をサポート
    const limit = config.maxRequests || config.max || 10;
    
    // 現在の時間窓内のリクエストを取得
    const requests = this.cache.get(key) || [];
    const recentRequests = requests.filter(time => time > windowStart);
    
    if (recentRequests.length >= limit) {
      const oldestRequest = recentRequests[0];
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
      const resetTime = new Date(oldestRequest + config.windowMs);
      
      return {
        allowed: false,
        retryAfter,
        remaining: 0,
        limit,
        resetTime,
      };
    }
    
    // 新しいリクエストを記録
    recentRequests.push(now);
    this.cache.set(key, recentRequests);
    
    return {
      allowed: true,
      remaining: limit - recentRequests.length,
      limit,
    };
  }

  /**
   * 成功したリクエストをカウントから除外
   */
  async recordSuccess(req: NextRequest, config: RateLimitConfig): Promise<void> {
    if (!config.skipSuccessfulRequests) return;
    
    const key = config.keyGenerator ? 
      config.keyGenerator(req) : 
      this.getClientIdentifier(req);
    
    const requests = this.cache.get(key) || [];
    
    // 最後のリクエストを削除（成功したので）
    if (requests.length > 0) {
      requests.pop();
      this.cache.set(key, requests);
    }
  }

  /**
   * クライアント識別子を生成
   */
  private getClientIdentifier(req: NextRequest): string {
    // IPアドレスの取得（プロキシ対応）
    const forwarded = req.headers.get('x-forwarded-for');
    const real = req.headers.get('x-real-ip');
    const cfConnecting = req.headers.get('cf-connecting-ip'); // Cloudflare
    
    const ip = cfConnecting || 
               forwarded?.split(',')[0].trim() || 
               real || 
               'unknown';
    
    // IPアドレス + User-Agentでより正確な識別
    const userAgent = req.headers.get('user-agent') || '';
    const hash = this.simpleHash(userAgent);
    
    return `${ip}:${hash}`;
  }

  /**
   * 簡易ハッシュ関数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * レート制限状態をリセット（テスト用）
   */
  reset(identifier?: string): void {
    if (identifier) {
      this.cache.delete(identifier);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 現在の使用状況を取得（デバッグ用）
   */
  getStats(): { totalKeys: number; cacheSize: number } {
    return {
      totalKeys: this.cache.size,
      cacheSize: this.cache.calculatedSize || 0,
    };
  }
}

// 異なるエンドポイント用の設定
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  login: {
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 5回まで
    skipSuccessfulRequests: true, // 成功したログインはカウントしない
    message: 'ログイン試行回数が多すぎます。15分後に再試行してください。',
  },
  signup: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 3, // 3回まで
    message: 'アカウント作成の試行回数が多すぎます。1時間後に再試行してください。',
  },
  forgotPassword: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 3, // 3回まで
    message: 'パスワードリセットの試行回数が多すぎます。1時間後に再試行してください。',
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1時間
    max: 20, // 20ファイルまで
    message: 'アップロード制限に達しました。1時間後に再試行してください。',
  },
  api: {
    windowMs: 60 * 1000, // 1分
    max: 100, // 100リクエストまで
    message: 'APIリクエストが多すぎます。しばらくお待ちください。',
  },
  strict: {
    windowMs: 60 * 1000, // 1分
    max: 10, // 10リクエストまで（より厳格）
    message: 'リクエストが多すぎます。',
  },
};

// シングルトンインスタンス
export const rateLimiter = new AdvancedRateLimiter();
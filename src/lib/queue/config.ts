import Redis from 'ioredis';
import logger from '@/lib/logger';

// Redis接続が必須かどうか
const REDIS_ENABLED = process.env.REDIS_ENABLED === 'true';

// Redis接続設定
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    if (times > 3) {
      // 3回以上失敗したら諦める
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Redisクライアントのシングルトンインスタンス
let redisClient: Redis | null = null;
let redisAvailable = false;

export function getRedisClient(): Redis | null {
  if (!REDIS_ENABLED) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisConfig);
    
    redisClient.on('connect', () => {
      logger.info('🚀 Redis connected successfully');
      redisAvailable = true;
    });

    redisClient.on('error', (err) => {
      // エラーをログに記録するが、アプリケーションを停止しない
      if (redisAvailable) {
        logger.warn('⚠️ Redis connection lost:', { message: err.message });
        redisAvailable = false;
      }
    });

    redisClient.on('close', () => {
      if (redisAvailable) {
        logger.info('🔌 Redis connection closed');
        redisAvailable = false;
      }
    });

    // 接続を試みる（失敗しても続行）
    redisClient.connect().catch((err) => {
      logger.warn('⚠️ Redis is not available, continuing without cache:', { message: err.message });
      redisAvailable = false;
    });
  }

  return redisAvailable ? redisClient : null;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

// キャッシュキー生成ヘルパー
export const cacheKeys = {
  translation: (text: string, targetLang: string) => 
    `translation:${targetLang}:${Buffer.from(text).toString('base64').slice(0, 32)}`,
  
  pptxProcessing: (fileHash: string) => 
    `pptx:process:${fileHash}`,
  
  userSession: (userId: string) => 
    `session:user:${userId}`,
  
  apiRateLimit: (ip: string, endpoint: string) => 
    `ratelimit:${endpoint}:${ip}`,
  
  jobStatus: (jobId: string) => 
    `job:status:${jobId}`,
};

// キャッシュ有効期限設定（秒）
export const cacheTTL = {
  translation: 7 * 24 * 60 * 60, // 7日間
  pptxProcessing: 60 * 60, // 1時間
  userSession: 24 * 60 * 60, // 24時間
  apiRateLimit: 60, // 1分
  jobStatus: 60 * 60, // 1時間
  default: 60 * 60, // デフォルト1時間
};
import Redis from 'ioredis';

// Redis接続設定
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Redisクライアントのシングルトンインスタンス
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);
    
    redisClient.on('connect', () => {
      console.log('🚀 Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis connection error:', err);
    });

    redisClient.on('close', () => {
      console.log('🔌 Redis connection closed');
    });
  }

  return redisClient;
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
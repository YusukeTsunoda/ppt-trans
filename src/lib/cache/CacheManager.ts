import { getRedisClient, cacheTTL } from '@/lib/queue/config';
import logger from '@/lib/logger';
import type Redis from 'ioredis';

export class CacheManager {
  private redis: Redis | null;
  private prefix: string;
  private memoryCache: Map<string, { value: any; expires: number }> = new Map();

  constructor(prefix: string = 'cache') {
    this.redis = getRedisClient();
    this.prefix = prefix;
    
    // Redisが利用できない場合のログ
    if (!this.redis) {
      logger.info(`CacheManager (${prefix}): Redis not available, using in-memory cache`);
    }
  }

  /**
   * キャッシュに値を設定
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number = cacheTTL.default
  ): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const expires = ttl > 0 ? Date.now() + (ttl * 1000) : 0;
      this.memoryCache.set(fullKey, { value, expires });
      this.cleanupMemoryCache();
      return true;
    }
    
    try {
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
      
      logger.debug(`Cache set: ${fullKey}`);
      return true;
    } catch (error) {
      logger.error('Cache set error', error, { key });
      return false;
    }
  }

  /**
   * キャッシュから値を取得
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const cached = this.memoryCache.get(fullKey);
      if (cached) {
        if (cached.expires === 0 || cached.expires > Date.now()) {
          return cached.value as T;
        }
        this.memoryCache.delete(fullKey);
      }
      return null;
    }
    
    try {
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }
      
      logger.debug(`Cache hit: ${fullKey}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', error, { key });
      return null;
    }
  }

  /**
   * キャッシュから値を削除
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      return this.memoryCache.delete(fullKey);
    }
    
    try {
      const result = await this.redis.del(fullKey);
      
      logger.debug(`Cache delete: ${fullKey}`);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  /**
   * キャッシュの存在確認
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const cached = this.memoryCache.get(fullKey);
      if (cached) {
        if (cached.expires === 0 || cached.expires > Date.now()) {
          return true;
        }
        this.memoryCache.delete(fullKey);
      }
      return false;
    }
    
    try {
      const result = await this.redis.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error', error, { key });
      return false;
    }
  }

  /**
   * TTLを設定
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const cached = this.memoryCache.get(fullKey);
      if (cached) {
        cached.expires = Date.now() + (ttl * 1000);
        return true;
      }
      return false;
    }
    
    try {
      const result = await this.redis.expire(fullKey, ttl);
      return result > 0;
    } catch (error) {
      logger.error('Cache expire error', error, { key });
      return false;
    }
  }

  /**
   * 残りTTLを取得
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const cached = this.memoryCache.get(fullKey);
      if (cached && cached.expires > 0) {
        const remaining = Math.floor((cached.expires - Date.now()) / 1000);
        return remaining > 0 ? remaining : -1;
      }
      return -1;
    }
    
    try {
      return await this.redis.ttl(fullKey);
    } catch (error) {
      logger.error('Cache ttl error', error, { key });
      return -1;
    }
  }

  /**
   * パターンマッチでキーを取得
   */
  async keys(pattern: string): Promise<string[]> {
    const fullPattern = this.getFullKey(pattern);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
      const keys: string[] = [];
      for (const [key] of this.memoryCache) {
        if (regex.test(key)) {
          keys.push(key.replace(`${this.prefix}:`, ''));
        }
      }
      return keys;
    }
    
    try {
      const keys = await this.redis.keys(fullPattern);
      return keys.map(k => k.replace(`${this.prefix}:`, ''));
    } catch (error) {
      logger.error('Cache keys error', error, { pattern });
      return [];
    }
  }

  /**
   * パターンマッチでキーを削除
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.getFullKey(pattern);
    
    // Redisが利用できない場合はメモリキャッシュを使用
    if (!this.redis) {
      const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
      let count = 0;
      for (const [key] of this.memoryCache) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          count++;
        }
      }
      return count;
    }
    
    try {
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      logger.debug(`Cache delete pattern: ${fullPattern}, deleted: ${result}`);
      return result;
    } catch (error) {
      logger.error('Cache delete pattern error', error, { pattern });
      return 0;
    }
  }

  /**
   * キャッシュをクリア
   */
  async clear(): Promise<boolean> {
    // Redisが利用できない場合はメモリキャッシュをクリア
    if (!this.redis) {
      const pattern = `${this.prefix}:`;
      let count = 0;
      for (const [key] of this.memoryCache) {
        if (key.startsWith(pattern)) {
          this.memoryCache.delete(key);
          count++;
        }
      }
      logger.info(`Memory cache cleared: ${count} keys deleted`);
      return true;
    }
    
    try {
      const pattern = `${this.prefix}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      
      logger.info(`Cache cleared: ${keys.length} keys deleted`);
      return true;
    } catch (error) {
      logger.error('Cache clear error', error);
      return false;
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStats(): Promise<{
    keyCount: number;
    memoryUsage: number;
    hitRate?: number;
  }> {
    // Redisが利用できない場合はメモリキャッシュの統計を返す
    if (!this.redis) {
      const pattern = `${this.prefix}:`;
      let count = 0;
      for (const [key] of this.memoryCache) {
        if (key.startsWith(pattern)) {
          count++;
        }
      }
      return {
        keyCount: count,
        memoryUsage: 0, // メモリ使用量は計測しない
        hitRate: undefined,
      };
    }
    
    try {
      const info = await this.redis.info('stats');
      const memory = await this.redis.info('memory');
      
      // 情報をパース
      const stats = this.parseRedisInfo(info);
      const memInfo = this.parseRedisInfo(memory);
      
      const keyCount = await this.redis.dbsize();
      const memoryUsage = parseInt(memInfo.used_memory || '0');
      
      // ヒット率を計算
      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        keyCount,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Cache stats error', error);
      return {
        keyCount: 0,
        memoryUsage: 0,
      };
    }
  }

  /**
   * キャッシュまたは計算を実行
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = cacheTTL.default
  ): Promise<T> {
    try {
      // キャッシュから取得を試みる
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
      
      // キャッシュになければ計算
      const value = await factory();
      
      // 結果をキャッシュに保存
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error', error, { key });
      // エラー時はファクトリー関数の結果を返す
      return factory();
    }
  }

  /**
   * 完全なキーを生成
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Redis INFO出力をパース
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }
  
  /**
   * メモリキャッシュの期限切れエントリをクリーンアップ
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache) {
      if (cached.expires > 0 && cached.expires < now) {
        this.memoryCache.delete(key);
      }
    }
    
    // メモリキャッシュのサイズ制限（1000エントリ）
    if (this.memoryCache.size > 1000) {
      const entriesToDelete = this.memoryCache.size - 900;
      const keys = Array.from(this.memoryCache.keys());
      for (let i = 0; i < entriesToDelete; i++) {
        this.memoryCache.delete(keys[i]);
      }
    }
  }
}

// シングルトンインスタンス
let defaultCacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!defaultCacheManager) {
    defaultCacheManager = new CacheManager();
  }
  return defaultCacheManager;
}

// 特定用途向けのキャッシュマネージャー（遅延初期化）
let _translationCache: CacheManager | null = null;
let _pptxCache: CacheManager | null = null;
let _sessionCache: CacheManager | null = null;
let _apiCache: CacheManager | null = null;

export const translationCache = (() => {
  if (!_translationCache) {
    _translationCache = new CacheManager('translation');
  }
  return _translationCache;
})();

export const pptxCache = (() => {
  if (!_pptxCache) {
    _pptxCache = new CacheManager('pptx');
  }
  return _pptxCache;
})();

export const sessionCache = (() => {
  if (!_sessionCache) {
    _sessionCache = new CacheManager('session');
  }
  return _sessionCache;
})();

export const apiCache = (() => {
  if (!_apiCache) {
    _apiCache = new CacheManager('api');
  }
  return _apiCache;
})();
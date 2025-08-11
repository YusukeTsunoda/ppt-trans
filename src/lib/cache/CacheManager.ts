import { getRedisClient, cacheTTL } from '@/lib/queue/config';
import logger from '@/lib/logger';
import type Redis from 'ioredis';

export class CacheManager {
  private redis: Redis;
  private prefix: string;

  constructor(prefix: string = 'cache') {
    this.redis = getRedisClient();
    this.prefix = prefix;
  }

  /**
   * キャッシュに値を設定
   */
  async set<T>(
    key: string,
    value: T,
    ttl: number = cacheTTL.default
  ): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const serialized = JSON.stringify(value);
      
      if (ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }
      
      logger.debug(`Cache set: ${fullKey}`);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error });
      return false;
    }
  }

  /**
   * キャッシュから値を取得
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      
      if (!value) {
        return null;
      }
      
      logger.debug(`Cache hit: ${fullKey}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * キャッシュから値を削除
   */
  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.del(fullKey);
      
      logger.debug(`Cache delete: ${fullKey}`);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error', { key, error });
      return false;
    }
  }

  /**
   * キャッシュの存在確認
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache exists error', { key, error });
      return false;
    }
  }

  /**
   * TTLを設定
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.expire(fullKey, ttl);
      return result > 0;
    } catch (error) {
      logger.error('Cache expire error', { key, error });
      return false;
    }
  }

  /**
   * 残りTTLを取得
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      logger.error('Cache ttl error', { key, error });
      return -1;
    }
  }

  /**
   * パターンマッチでキーを取得
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      return keys.map(k => k.replace(`${this.prefix}:`, ''));
    } catch (error) {
      logger.error('Cache keys error', { pattern, error });
      return [];
    }
  }

  /**
   * パターンマッチでキーを削除
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      logger.debug(`Cache delete pattern: ${fullPattern}, deleted: ${result}`);
      return result;
    } catch (error) {
      logger.error('Cache delete pattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * キャッシュをクリア
   */
  async clear(): Promise<boolean> {
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
      logger.error('Cache getOrSet error', { key, error });
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
}

// シングルトンインスタンス
let defaultCacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!defaultCacheManager) {
    defaultCacheManager = new CacheManager();
  }
  return defaultCacheManager;
}

// 特定用途向けのキャッシュマネージャー
export const translationCache = new CacheManager('translation');
export const pptxCache = new CacheManager('pptx');
export const sessionCache = new CacheManager('session');
export const apiCache = new CacheManager('api');
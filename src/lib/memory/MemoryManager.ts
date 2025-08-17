/**
 * メモリ使用量の監視と管理
 */

import logger from '@/lib/logger';
import type { CacheEntry, CacheStats, JsonValue } from '@/types/memory';

interface MemoryInfo {
  used: number;        // 使用中メモリ (MB)
  total: number;       // 総メモリ (MB)
  free: number;        // 空きメモリ (MB)
  percentage: number;  // 使用率 (%)
}

interface MemoryThresholds {
  warning: number;     // 警告レベル (%)
  critical: number;    // 危険レベル (%)
  emergency: number;   // 緊急レベル (%)
}

class MemoryManager {
  private static instance: MemoryManager;
  private readonly thresholds: MemoryThresholds = {
    warning: 70,
    critical: 85,
    emergency: 95,
  };

  private cache = new Map<string, CacheEntry<JsonValue>>();
  private maxCacheSize = 50 * 1024 * 1024; // 50MB
  private currentCacheSize = 0;

  private constructor() {
    // 定期的なメモリ監視（30秒間隔）
    if (typeof process !== 'undefined') {
      setInterval(() => {
        this.checkMemoryUsage();
      }, 30000);
    }

    // キャッシュのクリーンアップ（5分間隔）
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000);
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * メモリ使用状況を取得
   */
  public getMemoryInfo(): MemoryInfo {
    if (typeof process === 'undefined') {
      // ブラウザ環境では概算値を返す
      return {
        used: 0,
        total: 0,
        free: 0,
        percentage: 0,
      };
    }

    const usage = process.memoryUsage();
    const totalMB = usage.heapTotal / 1024 / 1024;
    const usedMB = usage.heapUsed / 1024 / 1024;
    const freeMB = totalMB - usedMB;
    const percentage = (usedMB / totalMB) * 100;

    return {
      used: Math.round(usedMB * 100) / 100,
      total: Math.round(totalMB * 100) / 100,
      free: Math.round(freeMB * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
    };
  }

  /**
   * メモリ使用量を監視してアクションを実行
   */
  private checkMemoryUsage(): void {
    const info = this.getMemoryInfo();
    
    if (info.percentage > this.thresholds.emergency) {
      logger.error('Emergency memory usage detected', { memoryInfo: info });
      this.emergencyCleanup();
    } else if (info.percentage > this.thresholds.critical) {
      logger.warn('Critical memory usage detected', { memoryInfo: info });
      this.criticalCleanup();
    } else if (info.percentage > this.thresholds.warning) {
      logger.info('High memory usage detected', { memoryInfo: info });
      this.warningCleanup();
    }
  }

  /**
   * 緊急時のメモリクリーンアップ
   */
  private emergencyCleanup(): void {
    logger.info('Performing emergency memory cleanup');
    
    // キャッシュを完全クリア
    this.clearCache();
    
    // ガベージコレクションを強制実行
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 重要レベルのメモリクリーンアップ
   */
  private criticalCleanup(): void {
    logger.info('Performing critical memory cleanup');
    
    // 古いキャッシュエントリを削除（75%削除）
    this.cleanupCache(0.75);
  }

  /**
   * 警告レベルのメモリクリーンアップ
   */
  private warningCleanup(): void {
    logger.info('Performing warning-level memory cleanup');
    
    // 古いキャッシュエントリを削除（25%削除）
    this.cleanupCache(0.25);
  }

  /**
   * キャッシュにデータを保存
   */
  public setCache(key: string, data: JsonValue, ttlMs: number = 10 * 60 * 1000): void {
    const dataStr = JSON.stringify(data);
    const size = Buffer.byteLength(dataStr, 'utf8');

    // キャッシュサイズをチェック
    if (this.currentCacheSize + size > this.maxCacheSize) {
      this.cleanupCache(0.3); // 30%削除してスペースを作る
    }

    // 既存のエントリがある場合はサイズを引く
    const existing = this.cache.get(key);
    if (existing) {
      this.currentCacheSize -= existing.size;
    }

    this.cache.set(key, {
      key,
      value: data,
      timestamp: Date.now(),
      ttl: ttlMs,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    });

    this.currentCacheSize += size;
  }

  /**
   * キャッシュからデータを取得
   */
  public getCache<T extends JsonValue = JsonValue>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 有効期限をチェック
    const now = Date.now();
    const expiryTime = entry.timestamp + (entry.ttl || 0);
    if (now > expiryTime) {
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
      return null;
    }

    // アクセス統計を更新
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.value as T;
  }

  /**
   * キャッシュのクリーンアップ
   */
  public cleanupCache(ratio: number = 1.0): void {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    // 期限切れのエントリを削除
    const expiredEntries = entries.filter(([, entry]) => {
      const expiryTime = entry.timestamp + (entry.ttl || 0);
      return now > expiryTime;
    });
    for (const [key, entry] of expiredEntries) {
      this.currentCacheSize -= entry.size;
      this.cache.delete(key);
    }

    // 必要に応じて古いエントリを追加削除
    if (ratio < 1.0) {
      const remainingEntries = Array.from(this.cache.entries());
      const sortedEntries = remainingEntries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
      const deleteCount = Math.floor(sortedEntries.length * ratio);

      for (let i = 0; i < deleteCount; i++) {
        const [key, entry] = sortedEntries[i];
        this.currentCacheSize -= entry.size;
        this.cache.delete(key);
      }
    }

    logger.info(`Cache cleanup completed. Current size: ${this.currentCacheSize / 1024 / 1024}MB`);
  }

  /**
   * キャッシュを完全クリア
   */
  public clearCache(): void {
    this.cache.clear();
    this.currentCacheSize = 0;
    logger.info('Cache completely cleared');
  }

  /**
   * 大きなファイルを小さなチャンクに分割
   */
  public createFileChunks(data: ArrayBuffer, chunkSize: number = 1024 * 1024): ArrayBuffer[] {
    const chunks: ArrayBuffer[] = [];
    const totalSize = data.byteLength;
    
    for (let start = 0; start < totalSize; start += chunkSize) {
      const end = Math.min(start + chunkSize, totalSize);
      chunks.push(data.slice(start, end));
    }

    logger.info(`File split into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * メモリ効率的なストリーム処理
   */
  public async processInChunks<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    chunkSize: number = 3,
    delayMs: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    const totalChunks = Math.ceil(items.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, items.length);
      const chunk = items.slice(start, end);

      logger.info(`Processing chunk ${i + 1}/${totalChunks} (${chunk.length} items)`);

      // チャンクを並行処理
      const chunkResults = await Promise.all(
        chunk.map((item, idx) => processor(item, start + idx))
      );
      
      results.push(...chunkResults);

      // メモリ使用量をチェック
      const memoryInfo = this.getMemoryInfo();
      if (memoryInfo.percentage > this.thresholds.critical) {
        logger.warn('High memory usage during chunk processing, triggering cleanup');
        this.criticalCleanup();
        
        // より長い遅延を追加
        await new Promise(resolve => setTimeout(resolve, delayMs * 3));
      } else {
        // 通常の遅延
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * メモリ使用量の統計情報を取得
   */
  public getMemoryStats(): { memory: MemoryInfo; cache: CacheStats; thresholds: MemoryThresholds } {
    const info = this.getMemoryInfo();
    
    return {
      memory: info,
      cache: {
        totalEntries: this.cache.size,
        memoryUsage: Math.round(this.currentCacheSize / 1024 / 1024 * 100) / 100,
        hitRate: 0, // TODO: 実装が必要
        missRate: 0, // TODO: 実装が必要
        evictionCount: 0, // TODO: 実装が必要
        oldestEntry: Math.min(...Array.from(this.cache.values()).map(e => e.lastAccessed)),
        newestEntry: Math.max(...Array.from(this.cache.values()).map(e => e.lastAccessed)),
      },
      thresholds: this.thresholds,
    };
  }
}

export const memoryManager = MemoryManager.getInstance();
export { MemoryManager };
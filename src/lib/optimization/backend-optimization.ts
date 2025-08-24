/**
 * バックエンド最適化の実装
 * API並列化とキャッシュ戦略
 */

import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

/**
 * デメリット1: 並列化による同時接続数の増加
 * 対策: コネクションプールとバッチング
 */
export class ConnectionPoolManager {
  private static pools = new Map<string, ConnectionPool>();
  
  static getPool(name: string, maxConnections: number = 10): ConnectionPool {
    if (!this.pools.has(name)) {
      this.pools.set(name, new ConnectionPool(name, maxConnections));
    }
    return this.pools.get(name)!;
  }
}

class ConnectionPool {
  private activeConnections = 0;
  private waitingQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    task: () => Promise<any>;
  }> = [];
  
  constructor(
    private name: string,
    private maxConnections: number
  ) {}
  
  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeConnections < this.maxConnections) {
      return this.executeTask(task);
    }
    
    // キューに追加して待機
    return new Promise((resolve, reject) => {
      this.waitingQueue.push({ resolve, reject, task });
    });
  }
  
  private async executeTask<T>(task: () => Promise<T>): Promise<T> {
    this.activeConnections++;
    try {
      const result = await task();
      this.processQueue();
      return result;
    } catch (error) {
      this.processQueue();
      throw error;
    } finally {
      this.activeConnections--;
    }
  }
  
  private processQueue(): void {
    if (this.waitingQueue.length > 0 && this.activeConnections < this.maxConnections) {
      const { resolve, reject, task } = this.waitingQueue.shift()!;
      this.executeTask(task).then(resolve).catch(reject);
    }
  }
}

/**
 * デメリット2: 重複クエリの実行
 * 対策: クエリデデュプリケーション
 */
export class QueryDeduplicator {
  private pendingQueries = new Map<string, Promise<any>>();
  
  async dedupe<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = 1000
  ): Promise<T> {
    // 既に同じクエリが実行中の場合は結果を待つ
    if (this.pendingQueries.has(key)) {
      return this.pendingQueries.get(key) as Promise<T>;
    }
    
    // 新しいクエリを実行
    const promise = queryFn().finally(() => {
      // TTL後にキャッシュから削除
      setTimeout(() => {
        this.pendingQueries.delete(key);
      }, ttl);
    });
    
    this.pendingQueries.set(key, promise);
    return promise;
  }
  
  generateKey(operation: string, params: any): string {
    const hash = crypto.createHash('md5');
    hash.update(operation);
    hash.update(JSON.stringify(params));
    return hash.digest('hex');
  }
}

/**
 * デメリット3: エラー時のカスケード失敗
 * 対策: サーキットブレーカーパターン
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1分
    private resetTimeout: number = 30000 // 30秒
  ) {}
  
  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T> {
    // サーキットが開いている場合
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else if (fallback) {
        return fallback();
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      
      // 成功した場合、カウンターをリセット
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
      }
      
      if (fallback && this.state === 'OPEN') {
        return fallback();
      }
      
      throw error;
    }
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
  
  getState(): string {
    return this.state;
  }
}

/**
 * デメリット4: キャッシュの不整合
 * 対策: 多層キャッシュとTTL管理
 */
export class MultiLayerCache {
  private memoryCache: LRUCache<string, any>;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  
  constructor(options: {
    maxSize?: number;
    ttl?: number;
  } = {}) {
    this.memoryCache = new LRUCache({
      max: options.maxSize || 100,
      ttl: options.ttl || 1000 * 60 * 5, // 5分
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: () => {
        this.cacheStats.evictions++;
      },
    });
  }
  
  async get<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: {
      ttl?: number;
      staleWhileRevalidate?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<T> {
    // 強制リフレッシュ
    if (options.forceRefresh) {
      const value = await fetchFn();
      this.set(key, value, options.ttl);
      return value;
    }
    
    // メモリキャッシュから取得
    const cached = this.memoryCache.get(key);
    if (cached !== undefined) {
      this.cacheStats.hits++;
      
      // stale-while-revalidate戦略
      if (options.staleWhileRevalidate) {
        // バックグラウンドで更新
        fetchFn().then(value => {
          this.set(key, value, options.ttl);
        }).catch(console.error);
      }
      
      return cached;
    }
    
    this.cacheStats.misses++;
    
    // データを取得してキャッシュ
    const value = await fetchFn();
    this.set(key, value, options.ttl);
    return value;
  }
  
  set(key: string, value: any, ttl?: number): void {
    this.memoryCache.set(key, value, { ttl });
  }
  
  delete(key: string): void {
    this.memoryCache.delete(key);
  }
  
  clear(): void {
    this.memoryCache.clear();
  }
  
  getStats() {
    return {
      ...this.cacheStats,
      size: this.memoryCache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
    };
  }
}

/**
 * デメリット5: バッチ処理のタイミング問題
 * 対策: インテリジェントバッチング
 */
export class BatchProcessor<T, R> {
  private batch: Array<{ item: T; resolve: (value: R) => void; reject: (error: any) => void }> = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private processFn: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize?: number;
      maxWaitTime?: number;
      onError?: (error: any) => void;
    } = {}
  ) {
    this.options.maxBatchSize = options.maxBatchSize || 10;
    this.options.maxWaitTime = options.maxWaitTime || 100;
  }
  
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batch.push({ item, resolve, reject });
      
      // バッチサイズに達したら即座に処理
      if (this.batch.length >= this.options.maxBatchSize!) {
        this.flush();
      } else if (!this.timer) {
        // タイマーをセット
        this.timer = setTimeout(() => this.flush(), this.options.maxWaitTime);
      }
    });
  }
  
  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.batch.length === 0) return;
    
    const currentBatch = [...this.batch];
    this.batch = [];
    
    try {
      const items = currentBatch.map(b => b.item);
      const results = await this.processFn(items);
      
      // 結果を各Promiseに配布
      currentBatch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      // エラーを各Promiseに配布
      currentBatch.forEach(b => b.reject(error));
      
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }
  
  async flushAndWait(): Promise<void> {
    await this.flush();
  }
}

/**
 * API並列化の実装例
 */
export class OptimizedAPIClient {
  private cache = new MultiLayerCache();
  private deduplicator = new QueryDeduplicator();
  private circuitBreaker = new CircuitBreaker();
  private batchProcessor: BatchProcessor<any, any>;
  
  constructor() {
    // バッチ翻訳処理の設定
    this.batchProcessor = new BatchProcessor(
      async (texts: string[]) => {
        // バッチ翻訳APIを呼び出し
        const response = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts }),
        });
        return response.json();
      },
      {
        maxBatchSize: 10,
        maxWaitTime: 200,
      }
    );
  }
  
  /**
   * 並列データ取得（最適化済み）
   */
  async fetchDashboardData(userId: string) {
    const pool = ConnectionPoolManager.getPool('dashboard', 5);
    
    // 並列実行だがコネクションプールで制御
    const [user, files, stats, recentActivity] = await Promise.all([
      pool.execute(() => this.fetchUserData(userId)),
      pool.execute(() => this.fetchUserFiles(userId)),
      pool.execute(() => this.fetchUserStats(userId)),
      pool.execute(() => this.fetchRecentActivity(userId)),
    ]);
    
    return { user, files, stats, recentActivity };
  }
  
  private async fetchUserData(userId: string) {
    const key = `user:${userId}`;
    return this.cache.get(key, async () => {
      return this.circuitBreaker.execute(async () => {
        // Supabaseクエリ
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user');
        return response.json();
      });
    }, { ttl: 60000, staleWhileRevalidate: true });
  }
  
  private async fetchUserFiles(userId: string) {
    const key = `files:${userId}`;
    return this.deduplicator.dedupe(key, async () => {
      // ファイル一覧の取得
      const response = await fetch(`/api/files?userId=${userId}`);
      return response.json();
    });
  }
  
  private async fetchUserStats(userId: string) {
    const key = `stats:${userId}`;
    return this.cache.get(key, async () => {
      // 統計情報の取得
      const response = await fetch(`/api/stats/${userId}`);
      return response.json();
    }, { ttl: 300000 }); // 5分間キャッシュ
  }
  
  private async fetchRecentActivity(userId: string) {
    // リアルタイムデータなのでキャッシュしない
    const response = await fetch(`/api/activity/${userId}?limit=10`);
    return response.json();
  }
  
  /**
   * バッチ翻訳の実行
   */
  async translateText(text: string): Promise<string> {
    return this.batchProcessor.add(text);
  }
}
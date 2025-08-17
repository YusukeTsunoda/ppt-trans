/**
 * メモリ管理関連の型定義
 */

import type { JsonValue, JsonObject } from './common';

// Re-export commonly used types
export type { JsonValue, JsonObject } from './common';

// キャッシュエントリの型
export interface CacheEntry<T = JsonValue> {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  metadata?: JsonObject;
}

// キャッシュ統計情報
export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry?: number;
  newestEntry?: number;
}

// メモリ管理の設定
export interface MemoryConfig {
  maxEntries: number;
  maxMemoryMB: number;
  defaultTTL: number;
  cleanupInterval: number;
  compressionEnabled: boolean;
  persistToDisk?: boolean;
}

// キャッシュキーのパターン
export type CacheKeyPattern = string | RegExp;

// キャッシュオプション
export interface CacheOptions {
  ttl?: number;
  priority?: number;
  tags?: string[];
  compression?: boolean;
  serializer?: 'json' | 'msgpack' | 'custom';
}

// メモリイベントの型
export type MemoryEventType = 
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_set'
  | 'cache_delete'
  | 'cache_expire'
  | 'cache_evict'
  | 'memory_warning'
  | 'cleanup_started'
  | 'cleanup_completed';

export interface MemoryEvent {
  type: MemoryEventType;
  key?: string;
  timestamp: Date;
  memoryUsage?: number;
  details?: JsonObject;
}

// タグベースのキャッシュ管理
export interface TaggedCache {
  tags: Set<string>;
  keys: Set<string>;
  createdAt: Date;
  lastUsed: Date;
}

// キャッシュの永続化オプション
export interface PersistenceOptions {
  enabled: boolean;
  filePath?: string;
  autoSave?: boolean;
  saveInterval?: number;
  compression?: boolean;
}
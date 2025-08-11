/**
 * 翻訳キャッシュシステム
 * 同じテキストの再翻訳を防ぎ、パフォーマンスを向上
 */

interface CacheEntry {
  translated: string;
  timestamp: number;
  targetLanguage: string;
  model: string;
}

class TranslationCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize = 1000, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * キャッシュキーを生成
   */
  private generateKey(original: string, targetLanguage: string, model: string): string {
    // テキスト、言語、モデルの組み合わせでユニークなキーを生成
    const normalized = original.trim().toLowerCase();
    return `${normalized}::${targetLanguage}::${model}`;
  }

  /**
   * キャッシュから翻訳を取得
   */
  get(original: string, targetLanguage: string, model: string): string | null {
    const key = this.generateKey(original, targetLanguage, model);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // TTLチェック
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // LRU: 最近使用したエントリを最後に移動
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.translated;
  }

  /**
   * キャッシュに翻訳を保存
   */
  set(original: string, translated: string, targetLanguage: string, model: string): void {
    const key = this.generateKey(original, targetLanguage, model);

    // キャッシュサイズ制限チェック
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // 最も古いエントリを削除（LRU）
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      translated,
      timestamp: Date.now(),
      targetLanguage,
      model
    });
  }

  /**
   * バッチ翻訳のキャッシュチェック
   */
  getBatch(
    texts: Array<{ id: string; original: string }>,
    targetLanguage: string,
    model: string
  ): {
    cached: Array<{ id: string; original: string; translated: string }>;
    uncached: Array<{ id: string; original: string }>;
  } {
    const cached = [];
    const uncached = [];

    for (const text of texts) {
      const cachedTranslation = this.get(text.original, targetLanguage, model);
      
      if (cachedTranslation) {
        cached.push({
          ...text,
          translated: cachedTranslation
        });
      } else {
        uncached.push(text);
      }
    }

    return { cached, uncached };
  }

  /**
   * バッチ翻訳をキャッシュに保存
   */
  setBatch(
    translations: Array<{ original: string; translated: string }>,
    targetLanguage: string,
    model: string
  ): void {
    for (const translation of translations) {
      this.set(translation.original, translation.translated, targetLanguage, model);
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // 実装可能：ヒット率の追跡
    };
  }

  /**
   * 期限切れエントリをクリーンアップ
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// シングルトンインスタンス
let cacheInstance: TranslationCache | null = null;

/**
 * 翻訳キャッシュのシングルトンインスタンスを取得
 */
export function getTranslationCache(): TranslationCache {
  if (!cacheInstance) {
    // 環境変数から設定を読み込み
    const maxSize = parseInt(process.env.TRANSLATION_CACHE_SIZE || '1000', 10);
    const ttlMinutes = parseInt(process.env.TRANSLATION_CACHE_TTL_MINUTES || '60', 10);
    
    cacheInstance = new TranslationCache(maxSize, ttlMinutes);
    
    // 定期的なクリーンアップ（10分ごと）
    if (typeof window !== 'undefined') {
      setInterval(() => {
        const removed = cacheInstance?.cleanup() || 0;
        if (removed > 0) {
          console.log(`Translation cache cleanup: removed ${removed} expired entries`);
        }
      }, 10 * 60 * 1000);
    }
  }
  
  return cacheInstance;
}

/**
 * キャッシュをリセット（テスト用）
 */
export function resetTranslationCache(): void {
  cacheInstance = null;
}
/**
 * 部分的成功を処理するユーティリティ
 */

import logger from '@/lib/logger';

export interface PartialResult<T> {
  successful: T[];
  failed: Array<{
    item: any;
    error: Error;
    index: number;
  }>;
  totalCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

/**
 * バッチ処理で部分的成功を許可
 */
export async function processWithPartialSuccess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    continueOnError?: boolean;
    minSuccessRate?: number;
    onItemComplete?: (index: number, success: boolean) => void;
    concurrency?: number;
  } = {}
): Promise<PartialResult<R>> {
  const {
    continueOnError = true,
    minSuccessRate = 0.5,
    onItemComplete,
    concurrency = 5,
  } = options;
  
  const successful: R[] = [];
  const failed: Array<{ item: T; error: Error; index: number }> = [];
  
  // 同時実行数を制限しながら処理
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }
  
  let currentIndex = 0;
  
  for (const chunk of chunks) {
    const promises = chunk.map(async (item, chunkIndex) => {
      const index = currentIndex + chunkIndex;
      try {
        const result = await processor(item, index);
        successful.push(result);
        onItemComplete?.(index, true);
        return { success: true, result, index };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failed.push({ item, error: err, index });
        onItemComplete?.(index, false);
        
        logger.warn(`Item processing failed at index ${index}`, { error: err });
        
        if (!continueOnError) {
          throw err;
        }
        
        return { success: false, error: err, index };
      }
    });
    
    await Promise.all(promises);
    currentIndex += chunk.length;
  }
  
  const totalCount = items.length;
  const successCount = successful.length;
  const failureCount = failed.length;
  const successRate = totalCount > 0 ? successCount / totalCount : 0;
  
  // 最小成功率をチェック
  if (successRate < minSuccessRate) {
    const error = new Error(
      `Processing failed: Success rate ${(successRate * 100).toFixed(1)}% ` +
      `is below minimum ${(minSuccessRate * 100).toFixed(1)}%`
    );
    logger.error('Partial success below threshold', {
      successCount,
      failureCount,
      totalCount,
      successRate,
      minSuccessRate,
    });
    throw error;
  }
  
  return {
    successful,
    failed,
    totalCount,
    successCount,
    failureCount,
    successRate,
  };
}

/**
 * タイムアウトで部分的な結果を返す
 */
export async function collectWithTimeout<T>(
  collector: AsyncGenerator<T>,
  timeoutMs: number,
  options: {
    minItems?: number;
    onItem?: (item: T, index: number) => void;
  } = {}
): Promise<{
  items: T[];
  timedOut: boolean;
  elapsedMs: number;
}> {
  const { minItems = 0, onItem } = options;
  const items: T[] = [];
  const startTime = Date.now();
  let timedOut = false;
  let index = 0;
  
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve();
    }, timeoutMs);
  });
  
  const collectionPromise = (async () => {
    for await (const item of collector) {
      items.push(item);
      onItem?.(item, index++);
      
      if (timedOut) {
        break;
      }
    }
  })();
  
  await Promise.race([collectionPromise, timeoutPromise]);
  
  const elapsedMs = Date.now() - startTime;
  
  // 最小アイテム数をチェック
  if (items.length < minItems && timedOut) {
    throw new Error(
      `Timeout after ${elapsedMs}ms: Collected only ${items.length} items, ` +
      `minimum required is ${minItems}`
    );
  }
  
  if (timedOut) {
    logger.warn('Collection timed out', {
      collectedItems: items.length,
      timeoutMs,
      elapsedMs,
    });
  }
  
  return {
    items,
    timedOut,
    elapsedMs,
  };
}

/**
 * 段階的なフォールバック処理
 */
export async function tryWithFallbacks<T>(
  strategies: Array<{
    name: string;
    fn: () => Promise<T>;
    timeout?: number;
  }>
): Promise<{ result: T; strategy: string; attempts: number }> {
  const errors: Array<{ strategy: string; error: Error }> = [];
  
  for (let i = 0; i < strategies.length; i++) {
    const { name, fn, timeout } = strategies[i];
    
    try {
      logger.info(`Trying strategy: ${name}`);
      
      let result: T;
      if (timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Strategy '${name}' timed out`)), timeout);
        });
        result = await Promise.race([fn(), timeoutPromise]);
      } else {
        result = await fn();
      }
      
      logger.info(`Strategy '${name}' succeeded`);
      return { result, strategy: name, attempts: i + 1 };
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push({ strategy: name, error: err });
      logger.warn(`Strategy '${name}' failed`, { error: err });
      
      // 最後の戦略でなければ続行
      if (i < strategies.length - 1) {
        continue;
      }
    }
  }
  
  // すべての戦略が失敗
  const errorDetails = errors
    .map(({ strategy, error }) => `${strategy}: ${error.message}`)
    .join('; ');
    
  throw new Error(`All strategies failed: ${errorDetails}`);
}

/**
 * 部分的な成功を含む結果をマージ
 */
export function mergePartialResults<T>(
  results: Array<PartialResult<T>>
): PartialResult<T> {
  const successful: T[] = [];
  const failed: Array<{ item: any; error: Error; index: number }> = [];
  let totalCount = 0;
  
  for (const result of results) {
    successful.push(...result.successful);
    failed.push(...result.failed);
    totalCount += result.totalCount;
  }
  
  const successCount = successful.length;
  const failureCount = failed.length;
  const successRate = totalCount > 0 ? successCount / totalCount : 0;
  
  return {
    successful,
    failed,
    totalCount,
    successCount,
    failureCount,
    successRate,
  };
}
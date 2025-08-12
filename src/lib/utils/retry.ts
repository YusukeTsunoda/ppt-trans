/**
 * リトライユーティリティ
 * 非同期関数の実行に失敗した場合、指定された回数まで自動的にリトライします
 */

export interface RetryOptions {
  /** 最大リトライ回数（デフォルト: 3） */
  maxRetries?: number;
  /** リトライ間の遅延時間（ミリ秒、デフォルト: 1000） */
  delay?: number;
  /** 指数バックオフを使用するか（デフォルト: true） */
  backoff?: boolean;
  /** バックオフの乗数（デフォルト: 2） */
  backoffMultiplier?: number;
  /** 最大遅延時間（ミリ秒、デフォルト: 30000） */
  maxDelay?: number;
  /** リトライ時のコールバック */
  onRetry?: (attempt: number, error: Error) => void;
  /** リトライ可能なエラーかを判定する関数 */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * デフォルトのリトライ可能エラー判定
 * ネットワークエラー、タイムアウト、一時的なエラーをリトライ対象とする
 */
function defaultShouldRetry(error: Error): boolean {
  // ネットワークエラー
  if (error.message.includes('fetch failed') || 
      error.message.includes('ECONNRESET') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')) {
    return true;
  }

  // HTTPステータスコードによる判定
  if ('status' in error) {
    const status = (error as any).status;
    // 429 (Too Many Requests), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
    if ([429, 502, 503, 504].includes(status)) {
      return true;
    }
  }

  // Claude APIのレート制限エラー
  if (error.message.includes('rate_limit_error') ||
      error.message.includes('overloaded_error')) {
    return true;
  }

  return false;
}

/**
 * 遅延を実行
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * リトライ機能付きで非同期関数を実行
 * @param fn 実行する非同期関数
 * @param options リトライオプション
 * @returns 関数の実行結果
 * @throws 最大リトライ回数を超えた場合、最後のエラーをスロー
 * 
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await fetchData(),
 *   {
 *     maxRetries: 3,
 *     delay: 1000,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay: initialDelay = 1000,
    backoff = true,
    backoffMultiplier = 2,
    maxDelay = 30000,
    onRetry,
    shouldRetry = defaultShouldRetry,
  } = options;

  let lastError: Error | undefined;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 関数を実行
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行またはリトライ不可能なエラーの場合はエラーをスロー
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      // リトライコールバックを呼び出し
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      // 遅延を実行
      await delay(currentDelay);

      // バックオフが有効な場合、次回の遅延時間を計算
      if (backoff) {
        currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
      }
    }
  }

  // ここには到達しないはずだが、TypeScriptの型チェックのため
  throw lastError || new Error('Retry failed');
}

/**
 * 条件付きリトライ
 * 特定の条件が満たされるまでリトライを続ける
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const result = await withRetry(fn, options);
  
  if (!condition(result)) {
    throw new Error('Condition not met after retries');
  }
  
  return result;
}

/**
 * バッチ処理用のリトライ
 * 複数の非同期処理を並列実行し、失敗したものだけリトライ
 */
export async function batchRetry<T>(
  tasks: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const results = await Promise.allSettled(
    tasks.map(task => withRetry(task, options))
  );

  return results.map(result => {
    if (result.status === 'fulfilled') {
      return { success: true, result: result.value };
    } else {
      return { success: false, error: result.reason };
    }
  });
}

/**
 * エクスポネンシャルバックオフ付きリトライの事前設定
 */
export const exponentialRetry = <T>(
  fn: () => Promise<T>,
  maxRetries: number = 5
): Promise<T> => {
  return withRetry(fn, {
    maxRetries,
    delay: 1000,
    backoff: true,
    backoffMultiplier: 2,
    maxDelay: 60000,
  });
};

/**
 * Claude API専用のリトライ設定
 */
export const claudeApiRetry = <T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> => {
  return withRetry(fn, {
    maxRetries: 3,
    delay: 2000,
    backoff: true,
    backoffMultiplier: 2,
    maxDelay: 30000,
    onRetry,
    shouldRetry: (error) => {
      // Claude API固有のエラー判定
      if (error.message.includes('rate_limit_error')) {
        return true;
      }
      if (error.message.includes('overloaded_error')) {
        return true;
      }
      if (error.message.includes('api_error')) {
        return true;
      }
      return defaultShouldRetry(error);
    },
  });
};
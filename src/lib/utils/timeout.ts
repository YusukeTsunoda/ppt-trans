/**
 * タイムアウト処理のユーティリティ
 */

export class TimeoutError extends Error {
  constructor(message = 'リクエストがタイムアウトしました') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Promiseにタイムアウトを設定する
 * @param promise 実行するPromise
 * @param timeoutMs タイムアウト時間（ミリ秒）
 * @param timeoutMessage タイムアウト時のエラーメッセージ
 * @returns タイムアウト機能付きのPromise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(timeoutMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeout]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * アップロード処理専用のタイムアウト設定
 * ファイルサイズに応じて動的にタイムアウト時間を調整
 * @param fileSizeBytes ファイルサイズ（バイト）
 * @returns タイムアウト時間（ミリ秒）
 */
export function calculateUploadTimeout(fileSizeBytes: number): number {
  const MIN_TIMEOUT = 30000; // 最小30秒
  const MAX_TIMEOUT = 300000; // 最大5分
  const BYTES_PER_SECOND = 100000; // 想定転送速度: 100KB/秒
  
  // ファイルサイズに基づいて計算（バッファを含む）
  const calculatedTimeout = (fileSizeBytes / BYTES_PER_SECOND) * 1000 * 2; // 2倍のバッファ
  
  // 最小値と最大値の範囲内に収める
  return Math.min(Math.max(calculatedTimeout, MIN_TIMEOUT), MAX_TIMEOUT);
}
/**
 * タイムアウト設定
 */

export const TimeoutConfig = {
  // API呼び出しのタイムアウト設定（ミリ秒）
  api: {
    claude: 120000,       // Claude API: 2分（大きなテキスト用）
    claudeFast: 30000,    // Claude API（小さなテキスト用）: 30秒
    fileUpload: 180000,   // ファイルアップロード: 3分（短縮）
    fileDownload: 90000,  // ファイルダウンロード: 1.5分（短縮）
    pptxGeneration: 120000, // PPTX生成: 2分（短縮）
  },
  
  // 処理のタイムアウト設定（ミリ秒）
  processing: {
    imageConversion: 90000,   // 画像変換: 1.5分/スライド（短縮）
    textExtraction: 45000,    // テキスト抽出: 45秒/スライド（短縮）
    translation: 75000,       // 翻訳: 1.25分/バッチ（短縮）
    totalOperation: 900000,   // 全体処理: 15分（短縮）
  },
  
  // リトライのタイムアウト設定
  retry: {
    maxDuration: 300000,  // 最大リトライ時間: 5分
    perAttempt: 30000,    // 各試行のタイムアウト: 30秒
  },
  
  // バッチ処理の設定（メモリ使用量削減）
  batch: {
    size: 3,              // バッチサイズ（削減）
    concurrency: 2,       // 同時実行数（削減）
    delayBetween: 500,    // バッチ間の遅延: 0.5秒（短縮）
    maxMemoryMB: 100,     // 最大メモリ使用量: 100MB
  },
  
  // ファイルサイズごとのタイムアウト調整
  fileSizeMultipliers: {
    small: 1,    // < 5MB: 標準タイムアウト
    medium: 1.5, // 5-20MB: 1.5倍
    large: 2,    // 20-50MB: 2倍
    xlarge: 3,   // > 50MB: 3倍
  },
} as const;

/**
 * ファイルサイズに基づいてタイムアウトを調整
 */
export function adjustTimeoutForFileSize(
  baseTimeout: number,
  fileSizeInBytes: number
): number {
  const MB = 1024 * 1024;
  
  if (fileSizeInBytes < 5 * MB) {
    return baseTimeout * TimeoutConfig.fileSizeMultipliers.small;
  } else if (fileSizeInBytes < 20 * MB) {
    return baseTimeout * TimeoutConfig.fileSizeMultipliers.medium;
  } else if (fileSizeInBytes < 50 * MB) {
    return baseTimeout * TimeoutConfig.fileSizeMultipliers.large;
  } else {
    return baseTimeout * TimeoutConfig.fileSizeMultipliers.xlarge;
  }
}

/**
 * スライド数に基づいてタイムアウトを調整
 */
export function adjustTimeoutForSlideCount(
  baseTimeout: number,
  slideCount: number
): number {
  // 5スライドごとに15%増加（最適化）
  const multiplier = 1 + Math.floor(slideCount / 5) * 0.15;
  return Math.min(baseTimeout * multiplier, TimeoutConfig.processing.totalOperation);
}

/**
 * テキスト量に基づいてタイムアウトを動的調整
 */
export function adjustTimeoutForTextLength(
  textLength: number
): number {
  const baseTimeout = TimeoutConfig.api.claudeFast;
  
  if (textLength < 500) {
    return baseTimeout; // 30秒
  } else if (textLength < 2000) {
    return TimeoutConfig.api.claude * 0.7; // 84秒
  } else {
    return TimeoutConfig.api.claude; // 120秒
  }
}

/**
 * メモリ使用量を監視してバッチサイズを調整
 */
export function getOptimalBatchSize(memoryUsageMB: number): number {
  const config = TimeoutConfig.batch;
  
  if (memoryUsageMB > config.maxMemoryMB * 0.8) {
    return Math.max(1, Math.floor(config.size * 0.5)); // 50%削減
  } else if (memoryUsageMB > config.maxMemoryMB * 0.6) {
    return Math.max(2, Math.floor(config.size * 0.7)); // 30%削減
  } else {
    return config.size;
  }
}

/**
 * タイムアウトエラーかどうかを判定
 */
export function isTimeoutError(error: any): boolean {
  if (!error) return false;
  
  // 標準的なタイムアウトエラーメッセージをチェック
  const timeoutMessages = [
    'timeout',
    'timed out',
    'request timeout',
    'operation timed out',
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
    'TimeoutError',
  ];
  
  const errorMessage = (error.message || error.toString()).toLowerCase();
  return timeoutMessages.some(msg => errorMessage.includes(msg));
}

/**
 * AbortSignalを使用したタイムアウト制御
 */
export function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  
  // クリーンアップ関数を追加
  (controller as any).clearTimeout = () => clearTimeout(timeoutId);
  
  return controller;
}

/**
 * Promise にタイムアウトを追加
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}
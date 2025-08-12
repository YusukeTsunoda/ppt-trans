/**
 * タイムアウト設定
 */

export const TimeoutConfig = {
  // API呼び出しのタイムアウト設定（ミリ秒）
  api: {
    claude: 60000,        // Claude API: 60秒
    fileUpload: 300000,   // ファイルアップロード: 5分
    fileDownload: 120000, // ファイルダウンロード: 2分
    pptxGeneration: 180000, // PPTX生成: 3分
  },
  
  // 処理のタイムアウト設定（ミリ秒）
  processing: {
    imageConversion: 120000,  // 画像変換: 2分/スライド
    textExtraction: 60000,    // テキスト抽出: 1分/スライド
    translation: 90000,       // 翻訳: 1.5分/バッチ
    totalOperation: 1800000,  // 全体処理: 30分
  },
  
  // リトライのタイムアウト設定
  retry: {
    maxDuration: 300000,  // 最大リトライ時間: 5分
    perAttempt: 30000,    // 各試行のタイムアウト: 30秒
  },
  
  // バッチ処理の設定
  batch: {
    size: 5,              // バッチサイズ
    concurrency: 3,       // 同時実行数
    delayBetween: 1000,   // バッチ間の遅延: 1秒
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
  // 10スライドごとに20%増加
  const multiplier = 1 + Math.floor(slideCount / 10) * 0.2;
  return Math.min(baseTimeout * multiplier, TimeoutConfig.processing.totalOperation);
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
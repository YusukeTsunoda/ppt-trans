import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';

export interface DownloadOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onProgress?: (progress: number, downloaded: number, total: number) => void;
  onRetry?: (attempt: number, error: Error) => void;
  signal?: AbortSignal;
  resumable?: boolean;
  chunkSize?: number;
}

export interface DownloadResult {
  success: boolean;
  blob?: Blob;
  error?: Error;
  attempts: number;
  bytesDownloaded: number;
}

export interface ResumableDownloadState {
  url: string;
  fileName: string;
  fileSize: number;
  downloadedChunks: number[];
  totalChunks: number;
  etag?: string;
  lastModified?: string;
}

export class DownloadManager {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 1000; // 1秒
  private static readonly DEFAULT_TIMEOUT = 300000; // 5分
  private static readonly DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
  private static resumableStates = new Map<string, ResumableDownloadState>();

  /**
   * ファイルをダウンロード（自動リトライ機能付き）
   */
  static async downloadWithRetry(
    url: string,
    fileName: string,
    options: DownloadOptions = {}
  ): Promise<DownloadResult> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      timeout = this.DEFAULT_TIMEOUT,
      onProgress,
      onRetry,
      signal,
      resumable = false
    } = options;

    logger.info('Starting download with retry', {
      url,
      fileName,
      maxRetries,
      resumable
    });

    let lastError: Error | null = null;
    let attempts = 0;
    let bytesDownloaded = 0;

    // レジューマブルダウンロードの状態を取得
    const resumeKey = this.getResumeKey(url, fileName);
    let resumeState = resumable ? this.resumableStates.get(resumeKey) : undefined;

    while (attempts < maxRetries) {
      attempts++;

      try {
        // ダウンロード中断チェック
        if (signal?.aborted) {
          throw new AppError(
            'Download cancelled',
            ErrorCodes.FILE_PROCESSING_FAILED,
            400,
            true,
            'ダウンロードがキャンセルされました',
            { reason: 'User cancelled' }
          );
        }

        const result = resumable && resumeState
          ? await this.resumeDownload(url, fileName, resumeState, { timeout, onProgress, signal })
          : await this.performDownload(url, { timeout, onProgress, signal });

        if (result.blob) {
          logger.info('Download completed successfully', {
            fileName,
            fileSize: result.blob.size,
            attempts
          });

          // レジューマブル状態をクリア
          if (resumable) {
            this.resumableStates.delete(resumeKey);
          }

          return {
            success: true,
            blob: result.blob,
            attempts,
            bytesDownloaded: result.blob.size
          };
        }

        // 部分的なダウンロード（レジューマブル）
        if (resumable && result.partialData) {
          resumeState = result.resumeState!;
          this.resumableStates.set(resumeKey, resumeState);
          bytesDownloaded = result.bytesDownloaded || 0;
        }

      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Download attempt ${attempts} failed`, {
          fileName,
          error: lastError.message,
          attempt: attempts,
          maxRetries
        });

        // リトライ可能かチェック
        if (attempts < maxRetries && this.isRetryableError(lastError)) {
          if (onRetry) {
            onRetry(attempts, lastError);
          }

          // 指数バックオフで待機
          const delay = retryDelay * Math.pow(2, attempts - 1);
          await this.delay(delay);

          // レジューマブルダウンロードの場合、進捗を保持
          if (resumable && resumeState) {
            logger.info('Resuming download from last position', {
              fileName,
              downloadedChunks: resumeState.downloadedChunks.length,
              totalChunks: resumeState.totalChunks
            });
          }
        } else {
          break;
        }
      }
    }

    // すべてのリトライが失敗
    const appError = lastError instanceof AppError
      ? lastError
      : new AppError(
          'Download failed after retries',
          ErrorCodes.FILE_PROCESSING_FAILED,
          500,
          false,
          'ダウンロードが失敗しました',
          { 
            fileName,
            url,
            attempts,
            bytesDownloaded,
            originalError: lastError?.message 
          }
        );

    logger.error('Download failed after all retries', {
      fileName,
      attempts,
      error: appError
    });

    return {
      success: false,
      error: appError,
      attempts,
      bytesDownloaded
    };
  }

  /**
   * 通常のダウンロード実行
   */
  private static async performDownload(
    url: string,
    options: {
      timeout?: number;
      onProgress?: (progress: number, downloaded: number, total: number) => void;
      signal?: AbortSignal;
      headers?: HeadersInit;
    } = {}
  ): Promise<{ blob?: Blob; partialData?: ArrayBuffer; bytesDownloaded?: number; resumeState?: ResumableDownloadState }> {
    const { timeout = this.DEFAULT_TIMEOUT, onProgress, signal, headers = {} } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // シグナルの結合
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AppError(
          `Download failed with status ${response.status}`,
          ErrorCodes.FILE_PROCESSING_FAILED,
          response.status,
          true,
          `ダウンロードが失敗しました (${response.status})`,
          { url }
        );
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (!response.body) {
        throw new AppError(
          'Response body is empty',
          ErrorCodes.FILE_PROCESSING_FAILED,
          500,
          false,
          'レスポンスが空です'
        );
      }

      // ストリーミングダウンロード
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let downloaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        downloaded += value.length;

        if (onProgress && total > 0) {
          const progress = (downloaded / total) * 100;
          onProgress(progress, downloaded, total);
        }
      }

      // チャンクを結合してBlobを作成
      const blob = new Blob(chunks as BlobPart[]);
      
      return { blob };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          'Download timeout',
          ErrorCodes.NETWORK_TIMEOUT,
          408,
          true,
          'ダウンロードがタイムアウトしました',
          { url, timeout }
        );
      }

      throw error;
    }
  }

  /**
   * レジューマブルダウンロード（中断した位置から再開）
   */
  private static async resumeDownload(
    url: string,
    fileName: string,
    resumeState: ResumableDownloadState,
    options: {
      timeout?: number;
      onProgress?: (progress: number, downloaded: number, total: number) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ blob?: Blob; partialData?: ArrayBuffer; bytesDownloaded?: number; resumeState?: ResumableDownloadState }> {
    const { downloadedChunks, totalChunks, fileSize } = resumeState;
    const chunkSize = Math.ceil(fileSize / totalChunks);
    
    logger.info('Resuming download', {
      fileName,
      downloadedChunks: downloadedChunks.length,
      totalChunks,
      fileSize
    });

    const allChunks: ArrayBuffer[] = new Array(totalChunks);
    let totalDownloaded = downloadedChunks.length * chunkSize;

    // 残りのチャンクをダウンロード
    for (let i = 0; i < totalChunks; i++) {
      if (downloadedChunks.includes(i)) {
        continue; // すでにダウンロード済み
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, fileSize - 1);

      try {
        const chunkData = await this.downloadChunk(url, start, end, options);
        allChunks[i] = chunkData;
        downloadedChunks.push(i);
        totalDownloaded += chunkData.byteLength;

        if (options.onProgress) {
          const progress = (totalDownloaded / fileSize) * 100;
          options.onProgress(progress, totalDownloaded, fileSize);
        }

        // 状態を更新
        resumeState.downloadedChunks = downloadedChunks;

      } catch (error) {
        // チャンクのダウンロードに失敗
        logger.warn(`Failed to download chunk ${i}`, {
          error: (error as Error).message,
          start,
          end
        });

        // 部分的なデータと状態を返す
        return {
          partialData: undefined,
          bytesDownloaded: totalDownloaded,
          resumeState
        };
      }
    }

    // すべてのチャンクをダウンロード完了
    if (downloadedChunks.length === totalChunks) {
      const blob = new Blob(allChunks);
      return { blob };
    }

    return {
      partialData: undefined,
      bytesDownloaded: totalDownloaded,
      resumeState
    };
  }

  /**
   * 範囲指定でチャンクをダウンロード
   */
  private static async downloadChunk(
    url: string,
    start: number,
    end: number,
    options: {
      timeout?: number;
      signal?: AbortSignal;
    } = {}
  ): Promise<ArrayBuffer> {
    const { timeout = this.DEFAULT_TIMEOUT, signal } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Range': `bytes=${start}-${end}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status !== 206) { // 206 = Partial Content
        throw new AppError(
          `Chunk download failed with status ${response.status}`,
          ErrorCodes.FILE_PROCESSING_FAILED,
          response.status,
          true,
          `チャンクのダウンロードが失敗しました (${response.status})`,
          { start, end }
        );
      }

      return await response.arrayBuffer();

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * ダウンロードURLから直接ファイルを保存
   */
  static async saveFile(blob: Blob, fileName: string): Promise<void> {
    try {
      // ブラウザのダウンロード機能を使用
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // メモリを解放
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      logger.info('File saved successfully', { fileName, size: blob.size });
    } catch (error) {
      logger.error('Failed to save file', error);
      throw new AppError(
        'Failed to save file',
        ErrorCodes.FILE_PROCESSING_FAILED,
        500,
        false,
        'ファイルの保存に失敗しました',
        { fileName, error: (error as Error).message }
      );
    }
  }

  /**
   * レジューム用のキーを生成
   */
  private static getResumeKey(url: string, fileName: string): string {
    return `${url}-${fileName}`;
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private static isRetryableError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isRetryable();
    }

    // ネットワークエラーやタイムアウトはリトライ可能
    const retryableMessages = [
      'network',
      'timeout',
      'failed to fetch',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT',
      'aborted'
    ];

    return retryableMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }

  /**
   * 遅延処理
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * レジューマブルダウンロードの状態をクリア
   */
  static clearResumeState(url: string, fileName: string): void {
    const key = this.getResumeKey(url, fileName);
    this.resumableStates.delete(key);
  }

  /**
   * すべてのレジューマブル状態をクリア
   */
  static clearAllResumeStates(): void {
    this.resumableStates.clear();
  }
}
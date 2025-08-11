import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';

export interface UploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  onRetry?: (attempt: number, error: Error) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  url?: string;
  error?: Error;
  attempts: number;
}

export interface ChunkMetadata {
  index: number;
  start: number;
  end: number;
  size: number;
  hash: string;
}

export class FileUploadManager {
  private static readonly DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 1000; // 1秒

  /**
   * ファイルをアップロード（リトライ機能付き）
   */
  static async uploadWithRetry(
    file: File,
    url: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      onProgress,
      onRetry,
      signal
    } = options;

    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts < maxRetries) {
      attempts++;

      try {
        // アップロード中断チェック
        if (signal?.aborted) {
          throw new AppError(
            'Upload cancelled',
            ErrorCodes.FILE_UPLOAD_FAILED,
            400,
            true,
            'アップロードがキャンセルされました',
            { reason: 'User cancelled' }
          );
        }

        const result = await this.performUpload(file, url, onProgress, signal);
        
        logger.info('File uploaded successfully', {
          fileName: file.name,
          fileSize: file.size,
          attempts
        });

        return {
          success: true,
          fileId: result.fileId,
          url: result.url,
          attempts
        };
      } catch (error) {
        lastError = error as Error;
        
        logger.warn(`Upload attempt ${attempts} failed`, {
          fileName: file.name,
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
        } else {
          break;
        }
      }
    }

    // すべてのリトライが失敗
    const appError = lastError instanceof AppError
      ? lastError
      : new AppError(
          'File upload failed after retries',
          ErrorCodes.FILE_UPLOAD_FAILED,
          500,
          false,
          'アップロードが失敗しました',
          { 
            fileName: file.name,
            fileSize: file.size,
            attempts,
            originalError: lastError?.message 
          }
        );

    logger.error('File upload failed after all retries', {
      fileName: file.name,
      attempts,
      error: appError
    });

    return {
      success: false,
      error: appError,
      attempts
    };
  }

  /**
   * 大容量ファイルをチャンク分割してアップロード
   */
  static async uploadInChunks(
    file: File,
    url: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      chunkSize = this.DEFAULT_CHUNK_SIZE,
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      onProgress,
      onChunkComplete,
      onRetry,
      signal
    } = options;

    const chunks = this.createChunks(file, chunkSize);
    const totalChunks = chunks.length;
    const uploadId = this.generateUploadId();
    
    logger.info('Starting chunked upload', {
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      chunkSize,
      uploadId
    });

    let uploadedChunks = 0;
    const failedChunks: number[] = [];

    // 各チャンクをアップロード
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let chunkSuccess = false;
      let attempts = 0;

      while (attempts < maxRetries && !chunkSuccess) {
        attempts++;

        try {
          // アップロード中断チェック
          if (signal?.aborted) {
            throw new AppError(
              'Upload cancelled',
              ErrorCodes.FILE_UPLOAD_FAILED,
              400,
              true,
              'アップロードがキャンセルされました',
              { reason: 'User cancelled', uploadId }
            );
          }

          await this.uploadChunk(
            chunk,
            url,
            {
              uploadId,
              chunkIndex: i,
              totalChunks,
              fileName: file.name,
              fileSize: file.size
            },
            signal
          );

          uploadedChunks++;
          chunkSuccess = true;

          // プログレス更新
          if (onProgress) {
            onProgress((uploadedChunks / totalChunks) * 100);
          }

          if (onChunkComplete) {
            onChunkComplete(i, totalChunks);
          }

          logger.debug(`Chunk ${i + 1}/${totalChunks} uploaded`, {
            uploadId,
            chunkIndex: i,
            attempts
          });

        } catch (error) {
          logger.warn(`Chunk upload attempt ${attempts} failed`, {
            uploadId,
            chunkIndex: i,
            error: (error as Error).message,
            attempt: attempts
          });

          if (attempts < maxRetries && this.isRetryableError(error as Error)) {
            if (onRetry) {
              onRetry(attempts, error as Error);
            }
            const delay = retryDelay * Math.pow(2, attempts - 1);
            await this.delay(delay);
          } else {
            failedChunks.push(i);
            break;
          }
        }
      }

      if (!chunkSuccess) {
        failedChunks.push(i);
      }
    }

    // アップロード完了処理
    if (failedChunks.length === 0) {
      try {
        const result = await this.completeChunkedUpload(
          uploadId,
          file.name,
          file.size,
          totalChunks,
          url
        );

        logger.info('Chunked upload completed', {
          uploadId,
          fileName: file.name,
          totalChunks
        });

        return {
          success: true,
          fileId: result.fileId,
          url: result.url,
          attempts: 1
        };
      } catch (error) {
        return {
          success: false,
          error: error as Error,
          attempts: 1
        };
      }
    } else {
      const error = new AppError(
        `Failed to upload ${failedChunks.length} chunks`,
        ErrorCodes.FILE_UPLOAD_FAILED,
        500,
        false,
        'チャンクアップロードに失敗しました'
      );

      logger.error('Chunked upload failed', {
        uploadId,
        failedChunks,
        totalChunks
      });

      return {
        success: false,
        error,
        attempts: maxRetries
      };
    }
  }

  /**
   * 通常のファイルアップロード実行
   */
  private static async performUpload(
    file: File,
    url: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<{ fileId: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      // プログレスイベント
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      // 完了イベント
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              fileId: response.fileId,
              url: response.url
            });
          } catch {
            reject(new AppError(
              'Invalid server response',
              ErrorCodes.FILE_UPLOAD_FAILED,
              500,
              false,
              'サーバーレスポンスが無効です'
            ));
          }
        } else {
          reject(new AppError(
            `Upload failed with status ${xhr.status}`,
            ErrorCodes.FILE_UPLOAD_FAILED,
            xhr.status,
            false,
            `アップロードに失敗しました (ステータス: ${xhr.status})`
          ));
        }
      });

      // エラーイベント
      xhr.addEventListener('error', () => {
        reject(new AppError(
          'Network error during upload',
          ErrorCodes.NETWORK_ERROR,
          0
        ));
      });

      // タイムアウトイベント
      xhr.addEventListener('timeout', () => {
        reject(new AppError(
          'Upload timeout',
          ErrorCodes.NETWORK_TIMEOUT,
          0
        ));
      });

      // アボートイベント
      if (signal) {
        signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new AppError(
            'Upload cancelled',
            ErrorCodes.FILE_UPLOAD_FAILED,
            400,
            false,
            'アップロードがキャンセルされました'
          ));
        });
      }

      // リクエスト送信
      xhr.open('POST', url);
      xhr.timeout = 300000; // 5分
      xhr.send(formData);
    });
  }

  /**
   * チャンクをアップロード
   */
  private static async uploadChunk(
    chunk: Blob,
    url: string,
    metadata: {
      uploadId: string;
      chunkIndex: number;
      totalChunks: number;
      fileName: string;
      fileSize: number;
    },
    signal?: AbortSignal
  ): Promise<void> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', metadata.uploadId);
    formData.append('chunkIndex', metadata.chunkIndex.toString());
    formData.append('totalChunks', metadata.totalChunks.toString());
    formData.append('fileName', metadata.fileName);
    formData.append('fileSize', metadata.fileSize.toString());

    const response = await fetch(`${url}/chunk`, {
      method: 'POST',
      body: formData,
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        `Chunk upload failed: ${errorText}`,
        ErrorCodes.FILE_UPLOAD_FAILED,
        response.status,
        true,
        'チャンクのアップロードに失敗しました',
        { chunkIndex: metadata.chunkIndex, uploadId: metadata.uploadId }
      );
    }
  }

  /**
   * チャンク分割アップロードの完了処理
   */
  private static async completeChunkedUpload(
    uploadId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
    url: string
  ): Promise<{ fileId: string; url: string }> {
    const response = await fetch(`${url}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId,
        fileName,
        fileSize,
        totalChunks
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        `Failed to complete chunked upload: ${errorText}`,
        ErrorCodes.FILE_UPLOAD_FAILED,
        response.status,
        false,
        'チャンクアップロードの完了に失敗しました',
        { uploadId }
      );
    }

    const result = await response.json();
    return {
      fileId: result.fileId,
      url: result.url
    };
  }

  /**
   * ファイルをチャンクに分割
   */
  private static createChunks(file: File, chunkSize: number): Blob[] {
    const chunks: Blob[] = [];
    let start = 0;

    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }

    return chunks;
  }

  /**
   * アップロードIDを生成
   */
  private static generateUploadId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
      'ETIMEDOUT'
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
   * ファイルのハッシュを計算（将来的な実装用）
   */
  static async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
}
/**
 * 大容量ファイルのチャンク処理ユーティリティ
 */

import logger from '@/lib/logger';

export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  isLast: boolean;
}

/**
 * ファイルをチャンクに分割して処理
 */
export async function processFileInChunks<T>(
  file: File | Blob,
  chunkSize: number,
  processor: (chunk: Blob, info: ChunkInfo) => Promise<T>,
  options: {
    onProgress?: (progress: number) => void;
    onChunkComplete?: (chunkIndex: number, result: T) => void;
    maxConcurrency?: number;
  } = {}
): Promise<T[]> {
  const { onProgress, onChunkComplete, maxConcurrency = 1 } = options;
  
  const fileSize = file.size;
  const totalChunks = Math.ceil(fileSize / chunkSize);
  const results: T[] = [];
  
  logger.info('Processing file in chunks', {
    fileSize,
    chunkSize,
    totalChunks,
    maxConcurrency,
  });
  
  // チャンク情報を生成
  const chunks: ChunkInfo[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    chunks.push({
      index: i,
      start,
      end,
      size: end - start,
      isLast: i === totalChunks - 1,
    });
  }
  
  // 並行処理の管理
  let currentIndex = 0;
  const inProgress = new Set<number>();
  
  const processChunk = async (chunkInfo: ChunkInfo): Promise<void> => {
    const chunk = file.slice(chunkInfo.start, chunkInfo.end);
    
    try {
      inProgress.add(chunkInfo.index);
      const result = await processor(chunk, chunkInfo);
      results[chunkInfo.index] = result;
      
      onChunkComplete?.(chunkInfo.index, result);
      
      const progress = ((chunkInfo.index + 1) / totalChunks) * 100;
      onProgress?.(progress);
      
      logger.debug('Chunk processed', {
        chunkIndex: chunkInfo.index,
        chunkSize: chunkInfo.size,
        progress,
      });
    } finally {
      inProgress.delete(chunkInfo.index);
    }
  };
  
  // 並行処理を実行
  while (currentIndex < chunks.length || inProgress.size > 0) {
    // 新しいチャンクを開始
    while (inProgress.size < maxConcurrency && currentIndex < chunks.length) {
      processChunk(chunks[currentIndex]).catch(error => {
        logger.error('Chunk processing failed', {
          chunkIndex: currentIndex,
          error,
        });
        throw error;
      });
      currentIndex++;
    }
    
    // 少し待機
    if (inProgress.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

/**
 * スライドごとに処理（メモリ効率的）
 */
export async function* processSlideBySlide(
  slides: any[],
  processor: (slide: any, index: number) => Promise<any>,
  options: {
    batchSize?: number;
    onSlideComplete?: (index: number) => void;
  } = {}
): AsyncGenerator<any> {
  const { batchSize = 1, onSlideComplete } = options;
  
  for (let i = 0; i < slides.length; i += batchSize) {
    const batch = slides.slice(i, Math.min(i + batchSize, slides.length));
    
    const results = await Promise.all(
      batch.map(async (slide, batchIndex) => {
        const slideIndex = i + batchIndex;
        const result = await processor(slide, slideIndex);
        onSlideComplete?.(slideIndex);
        return result;
      })
    );
    
    for (const result of results) {
      yield result;
    }
  }
}

/**
 * メモリ効率的なテキスト抽出
 */
export class StreamingTextExtractor {
  private buffer: string[] = [];
  private readonly maxBufferSize: number;
  private processedCount = 0;
  
  constructor(maxBufferSize: number = 100) {
    this.maxBufferSize = maxBufferSize;
  }
  
  /**
   * テキストを追加
   */
  add(text: string): void {
    this.buffer.push(text);
    this.processedCount++;
  }
  
  /**
   * バッファがいっぱいかチェック
   */
  shouldFlush(): boolean {
    return this.buffer.length >= this.maxBufferSize;
  }
  
  /**
   * バッファをフラッシュ
   */
  flush(): string[] {
    const result = [...this.buffer];
    this.buffer = [];
    return result;
  }
  
  /**
   * 残りのテキストを取得
   */
  getRemainingTexts(): string[] {
    return this.flush();
  }
  
  /**
   * 処理済みカウントを取得
   */
  getProcessedCount(): number {
    return this.processedCount;
  }
}

/**
 * 大容量ファイルのアップロード（チャンク）
 */
export async function uploadLargeFile(
  file: File,
  uploadUrl: string,
  options: {
    chunkSize?: number;
    onProgress?: (progress: number) => void;
    headers?: Record<string, string>;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { chunkSize = 5 * 1024 * 1024, onProgress, headers = {} } = options; // デフォルト5MB
  
  try {
    const chunks = await processFileInChunks(
      file,
      chunkSize,
      async (chunk, info) => {
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('chunkIndex', info.index.toString());
        formData.append('totalChunks', Math.ceil(file.size / chunkSize).toString());
        formData.append('fileName', file.name);
        formData.append('isLast', info.isLast.toString());
        
        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
          headers: {
            ...headers,
            'X-Chunk-Index': info.index.toString(),
            'X-Total-Chunks': Math.ceil(file.size / chunkSize).toString(),
          },
        });
        
        if (!response.ok) {
          throw new Error(`Chunk ${info.index} upload failed: ${response.statusText}`);
        }
        
        return await response.json();
      },
      {
        onProgress,
        maxConcurrency: 3, // 3つまで並行アップロード
      }
    );
    
    logger.info('Large file uploaded successfully', {
      fileName: file.name,
      fileSize: file.size,
      chunksUploaded: chunks.length,
    });
    
    return { success: true };
  } catch (error) {
    logger.error('Large file upload failed', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * ファイルサイズをフォーマット
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * ファイルサイズ制限をチェック
 */
export function checkFileSizeLimit(
  fileSize: number,
  maxSize: number
): { allowed: boolean; message?: string } {
  if (fileSize <= maxSize) {
    return { allowed: true };
  }
  
  return {
    allowed: false,
    message: `ファイルサイズが制限（${formatFileSize(maxSize)}）を超えています。現在のサイズ: ${formatFileSize(fileSize)}`,
  };
}
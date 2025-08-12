import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { ApiClient } from '@/lib/api/ApiClient';

export interface TranslationChunk {
  id: string;
  slideNumber: number;
  text: string;
  translatedText?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts?: number;
  error?: string;
}

export interface TranslationOptions {
  model?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  batchSize?: number;
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (progress: number, completedChunks: number, totalChunks: number) => void;
  onChunkComplete?: (chunk: TranslationChunk) => void;
  onChunkError?: (chunk: TranslationChunk, error: Error) => void;
  signal?: AbortSignal;
}

export interface TranslationResult {
  success: boolean;
  completedChunks: TranslationChunk[];
  failedChunks: TranslationChunk[];
  partialSuccess: boolean;
  totalAttempts: number;
}

export class TranslationManager {
  private static readonly DEFAULT_BATCH_SIZE = 5;
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY = 2000; // 2秒

  /**
   * テキストチャンクを翻訳（部分的な再試行機能付き）
   */
  static async translateWithPartialRetry(
    chunks: TranslationChunk[],
    apiKey: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult> {
    const {
      model = 'claude-3-haiku-20240307',
      targetLanguage,
      sourceLanguage,
      batchSize = this.DEFAULT_BATCH_SIZE,
      maxRetries = this.DEFAULT_MAX_RETRIES,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      onProgress,
      onChunkComplete,
      onChunkError,
      signal
    } = options;

    // 言語パラメータの検証
    if (!targetLanguage || !sourceLanguage) {
      throw new AppError(
        'Source and target languages are required',
        ErrorCodes.VALIDATION_REQUIRED_FIELD,
        400,
        false,
        '翻訳元言語と翻訳先言語を指定してください'
      );
    }

    logger.info('Starting translation with partial retry', {
      totalChunks: chunks.length,
      batchSize,
      model,
      sourceLanguage,
      targetLanguage
    });

    const completedChunks: TranslationChunk[] = [];
    const failedChunks: TranslationChunk[] = [];
    let totalAttempts = 0;

    // バッチに分割
    const batches = this.createBatches(chunks, batchSize);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // アボートチェック
      if (signal?.aborted) {
        const remaining = chunks.filter(c => c.status === 'pending');
        failedChunks.push(...remaining.map(c => ({
          ...c,
          status: 'failed' as const,
          error: 'Translation cancelled'
        })));
        break;
      }

      // バッチ内の各チャンクを処理
      for (const chunk of batch) {
        let success = false;
        let attempts = 0;

        while (attempts < maxRetries && !success) {
          attempts++;
          totalAttempts++;

          try {
            // アボートチェック
            if (signal?.aborted) {
              chunk.status = 'failed';
              chunk.error = 'Translation cancelled';
              failedChunks.push(chunk);
              break;
            }

            chunk.status = 'processing';
            
            const translatedText = await this.translateSingleChunk(
              chunk.text,
              apiKey,
              {
                model,
                targetLanguage,
                sourceLanguage,
                slideNumber: chunk.slideNumber
              }
            );

            chunk.translatedText = translatedText;
            chunk.status = 'completed';
            chunk.attempts = attempts;
            completedChunks.push(chunk);
            success = true;

            if (onChunkComplete) {
              onChunkComplete(chunk);
            }

            logger.debug(`Chunk ${chunk.id} translated successfully`, {
              slideNumber: chunk.slideNumber,
              attempts
            });

          } catch (error) {
            const err = error as Error;
            logger.warn(`Translation attempt ${attempts} failed for chunk ${chunk.id}`, {
              error: err.message,
              slideNumber: chunk.slideNumber,
              attempt: attempts
            });

            if (attempts < maxRetries && this.isRetryableError(err)) {
              // 指数バックオフで待機
              const delay = retryDelay * Math.pow(2, attempts - 1);
              await this.delay(delay);
            } else {
              chunk.status = 'failed';
              chunk.error = err.message;
              chunk.attempts = attempts;
              failedChunks.push(chunk);
              
              if (onChunkError) {
                onChunkError(chunk, err);
              }
              break;
            }
          }
        }
      }

      // プログレス更新
      if (onProgress) {
        const progress = ((completedChunks.length + failedChunks.length) / chunks.length) * 100;
        onProgress(progress, completedChunks.length, chunks.length);
      }
    }

    const partialSuccess = completedChunks.length > 0 && failedChunks.length > 0;
    const success = failedChunks.length === 0;

    logger.info('Translation completed', {
      success,
      partialSuccess,
      completedChunks: completedChunks.length,
      failedChunks: failedChunks.length,
      totalAttempts
    });

    return {
      success,
      completedChunks,
      failedChunks,
      partialSuccess,
      totalAttempts
    };
  }

  /**
   * 失敗したチャンクのみを再翻訳
   */
  static async retryFailedChunks(
    failedChunks: TranslationChunk[],
    apiKey: string,
    options: TranslationOptions = {}
  ): Promise<TranslationResult> {
    logger.info('Retrying failed chunks', {
      failedCount: failedChunks.length
    });

    // 失敗したチャンクをリセット
    const chunksToRetry = failedChunks.map(chunk => ({
      ...chunk,
      status: 'pending' as const,
      error: undefined,
      attempts: undefined
    }));

    return this.translateWithPartialRetry(chunksToRetry, apiKey, options);
  }

  /**
   * 単一チャンクの翻訳
   */
  private static async translateSingleChunk(
    text: string,
    apiKey: string,
    options: {
      model: string;
      targetLanguage: string;
      sourceLanguage: string;
      slideNumber?: number;
    }
  ): Promise<string> {
    const { model, targetLanguage, sourceLanguage, slideNumber } = options;

    const effectiveSourceLanguage = (!sourceLanguage || sourceLanguage === 'auto') 
      ? 'the source language (auto-detect)' 
      : sourceLanguage;
    
    const systemPrompt = `You are a professional translator. Translate the following text from ${effectiveSourceLanguage} to ${targetLanguage}. 
${(!sourceLanguage || sourceLanguage === 'auto') ? 'Automatically detect the source language.' : ''}
Maintain the original formatting and style. This is slide ${slideNumber ? `#${slideNumber}` : 'content'} from a presentation.`;

    const apiClient = new ApiClient();
    const response = await apiClient.request<{ translatedText: string }>({
      url: '/api/translate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        text,
        model,
        targetLanguage,
        sourceLanguage,
        systemPrompt
      }),
      retries: 3,
      timeout: 120000, // 2分
    });

    if (!response.data) {
      throw response.error || new AppError(
        'Translation API error',
        ErrorCodes.TRANSLATION_API_ERROR,
        response.status,
        true,
        '翻訳APIでエラーが発生しました',
        { slideNumber, textLength: text.length }
      );
    }

    return response.data.translatedText;
  }

  /**
   * バッチ翻訳（効率化のため）
   */
  static async translateBatch(
    texts: string[],
    apiKey: string,
    options: {
      model?: string;
      targetLanguage?: string;
      sourceLanguage?: string;
    } = {}
  ): Promise<string[]> {
    const {
      model = 'claude-3-haiku-20240307',
      targetLanguage,
      sourceLanguage
    } = options;

    // 言語パラメータの検証
    if (!targetLanguage || !sourceLanguage) {
      throw new AppError(
        'Source and target languages are required',
        ErrorCodes.VALIDATION_REQUIRED_FIELD,
        400,
        false,
        '翻訳元言語と翻訳先言語を指定してください'
      );
    }

    const batchPrompt = texts.map((text, index) => 
      `[TEXT_${index}]\n${text}\n[/TEXT_${index}]`
    ).join('\n\n');

    const systemPrompt = `You are a professional translator. Translate each text block from ${sourceLanguage} to ${targetLanguage}.
Return the translations in the same format with [TRANSLATION_N] tags.`;

    try {
      const apiClient = new ApiClient();
      const response = await apiClient.request<{ translatedText: string }>({
        url: '/api/translate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          text: batchPrompt,
          model,
          targetLanguage,
          sourceLanguage,
          systemPrompt,
          isBatch: true
        }),
        retries: 3,
        timeout: 180000, // 3分（バッチ処理用）
      });

      if (!response.data) {
        throw response.error || new AppError(
          'Batch translation failed',
          ErrorCodes.TRANSLATION_API_ERROR,
          response.status
        );
      }

      const result = response.data;
      
      // バッチ応答をパース
      const translations = this.parseBatchResponse(result.translatedText, texts.length);
      return translations;

    } catch (error) {
      logger.error('Batch translation failed', error);
      // フォールバック: 個別に翻訳
      return Promise.all(
        texts.map(text => 
          this.translateSingleChunk(text, apiKey, {
            model,
            targetLanguage,
            sourceLanguage
          })
        )
      );
    }
  }

  /**
   * バッチ応答をパース
   */
  private static parseBatchResponse(response: string, expectedCount: number): string[] {
    const translations: string[] = [];
    
    for (let i = 0; i < expectedCount; i++) {
      const regex = new RegExp(`\\[TRANSLATION_${i}\\]([\\s\\S]*?)\\[/TRANSLATION_${i}\\]`);
      const match = response.match(regex);
      
      if (match) {
        translations.push(match[1].trim());
      } else {
        // パースに失敗した場合は空文字列
        translations.push('');
        logger.warn(`Failed to parse translation for index ${i}`);
      }
    }

    return translations;
  }

  /**
   * チャンクをバッチに分割
   */
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private static isRetryableError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isRetryable();
    }

    // APIレート制限やタイムアウトはリトライ可能
    const retryableMessages = [
      'rate limit',
      'timeout',
      'network',
      'ECONNRESET',
      'ETIMEDOUT',
      '429',
      '503',
      '504'
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
   * 翻訳の品質をチェック（簡易版）
   */
  static validateTranslation(
    original: string,
    translated: string,
    targetLanguage?: string
  ): boolean {
    // 翻訳が空でないか
    if (!translated || translated.trim().length === 0) {
      return false;
    }

    // 元のテキストと同じでないか（翻訳されていない）
    if (original === translated) {
      logger.warn('Translation identical to original', {
        originalLength: original.length,
        targetLanguage
      });
      return false;
    }

    // 翻訳が極端に短くないか（言語によって長さの比率は異なるため、緩めの基準）
    if (translated.length < original.length * 0.1) {
      logger.warn('Translation suspiciously short', {
        originalLength: original.length,
        translatedLength: translated.length
      });
      return false;
    }

    return true;
  }
}
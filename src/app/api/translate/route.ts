import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { TextToTranslate, TranslatedText } from '../../../types';
import { getTranslationCache } from '../../../lib/translationCache';
import { validateTranslationRequest } from '../../../lib/validationUtils';
import { AppError } from '../../../lib/errors/AppError';
import { ErrorCodes } from '../../../lib/errors/ErrorCodes';
import logger, { logHttpRequest } from '@/lib/logger';


// Anthropicクライアントの初期化（シングルトン）
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// バッチサイズの定義（動的に調整可能）
const DEFAULT_BATCH_SIZE = 20;
const MAX_PARALLEL_BATCHES = 3; // 並列処理の最大数

/**
 * バッチを並列で翻訳
 */
async function translateBatchParallel(
  batch: TextToTranslate[],
  targetLanguage: string,
  model: string,
  anthropic: Anthropic
): Promise<TranslatedText[]> {
  const prompt = `
You are a professional translator specializing in PowerPoint presentations.
Translate the following texts while maintaining:
1. Professional tone appropriate for presentations
2. Technical terms accuracy
3. Conciseness for slide readability
4. Cultural appropriateness

Target Language: ${targetLanguage}

IMPORTANT: Return ONLY a valid JSON array with the exact same structure as input.
Each object must have: id, original, and translated fields.
Do not include any explanations or markdown formatting.

Input JSON:
${JSON.stringify(batch, null, 2)}

Output JSON array:`;

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: Math.min(4096, batch.length * 200),
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const responseContent = msg.content[0];
    
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    // JSONの抽出
    let responseText = responseContent.text.trim();
    responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    
    const startIdx = responseText.indexOf('[');
    const endIdx = responseText.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1) {
      responseText = responseText.substring(startIdx, endIdx + 1);
    }

    return JSON.parse(responseText);
  } catch (error) {
    // API rate limit error
    if (error instanceof Error && error.message.includes('rate')) {
      throw new AppError(
        'Translation API rate limited',
        ErrorCodes.TRANSLATION_RATE_LIMITED,
        429,
        true,
        '翻訳APIのレート制限に達しました。しばらく待ってから再度お試しください'
      );
    }
    
    // API timeout
    if (error instanceof Error && error.message.includes('timeout')) {
      throw new AppError(
        'Translation timeout',
        ErrorCodes.TRANSLATION_TIMEOUT,
        504,
        true,
        '翻訳処理がタイムアウトしました'
      );
    }
    
    logger.warn('Batch translation error, returning original text', { 
      error: error instanceof Error ? error.message : String(error),
      batchSize: batch.length 
    });
    
    // エラー時は元のテキストを返す（フォールバック）
    return batch.map(text => ({
      id: text.id,
      original: text.original,
      translated: text.original
    }));
  }
}

/**
 * 並列処理でテキストを翻訳
 */
async function translateWithParallelProcessing(
  texts: TextToTranslate[],
  targetLanguage: string,
  model: string
): Promise<TranslatedText[]> {
  const anthropic = getAnthropicClient();
  const cache = getTranslationCache();
  
  // キャッシュチェック
  const { cached, uncached } = cache.getBatch(texts, targetLanguage, model);
  
  console.log(`Translation cache: ${cached.length} cached, ${uncached.length} to translate`);
  
  if (uncached.length === 0) {
    return cached;
  }

  // バッチサイズを動的に調整
  const batchSize = Math.min(
    DEFAULT_BATCH_SIZE,
    Math.ceil(uncached.length / MAX_PARALLEL_BATCHES)
  );

  // バッチに分割
  const batches: TextToTranslate[][] = [];
  for (let i = 0; i < uncached.length; i += batchSize) {
    batches.push(uncached.slice(i, i + batchSize));
  }

  console.log(`Processing ${batches.length} batches in parallel (max ${MAX_PARALLEL_BATCHES} at a time)`);

  // 並列処理の実行
  const allTranslations: TranslatedText[] = [...cached];
  
  // バッチを並列処理のグループに分割
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_BATCHES) {
    const parallelGroup = batches.slice(i, i + MAX_PARALLEL_BATCHES);
    
    // グループ内のバッチを並列処理
    const parallelPromises = parallelGroup.map(batch =>
      translateBatchParallel(batch, targetLanguage, model, anthropic)
    );
    
    const results = await Promise.all(parallelPromises);
    
    // 結果を統合してキャッシュに保存
    for (const batchResult of results) {
      allTranslations.push(...batchResult);
      
      // キャッシュに保存
      cache.setBatch(
        batchResult.map(t => ({
          original: t.original,
          translated: t.translated
        })),
        targetLanguage,
        model
      );
    }
    
    // API レート制限を考慮した待機
    if (i + MAX_PARALLEL_BATCHES < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allTranslations;
}

/**
 * @deprecated This API endpoint is deprecated. Use Server Action: translateText or batchTranslate from @/server-actions/translate/process instead.
 */
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    
    // 入力検証
    const validation = validateTranslationRequest(body);
    if (!validation.valid) {
      const error = new AppError(
        'Invalid translation request',
        ErrorCodes.VALIDATION_INVALID_FORMAT,
        400,
        true,
        validation.error || '入力データが正しくありません'
      );
      logger.logAppError(error);
      logHttpRequest('POST', '/api/translate', 400, Date.now() - startTime);
      return NextResponse.json(error.toClientResponse(), { status: 400 });
    }

    const { texts, targetLanguage, model } = validation.data!;

    // 空のテキストチェック
    if (!texts || texts.length === 0) {
      const error = new AppError(
        'No texts to translate',
        ErrorCodes.TRANSLATION_EMPTY_TEXT,
        400,
        true,
        '翻訳するテキストが空です'
      );
      logger.logAppError(error);
      logHttpRequest('POST', '/api/translate', 400, Date.now() - startTime);
      return NextResponse.json(error.toClientResponse(), { status: 400 });
    }

    // APIキーの確認
    if (!process.env.ANTHROPIC_API_KEY) {
      const error = new AppError(
        'ANTHROPIC_API_KEY is not configured',
        ErrorCodes.CONFIGURATION_ERROR,
        500,
        false,
        'APIキーが設定されていません'
      );
      logger.logAppError(error);
      logHttpRequest('POST', '/api/translate', 500, Date.now() - startTime);
      return NextResponse.json(error.toClientResponse(), { status: 500 });
    }

    // モデル選択
    let selectedModel = model;
    if (!selectedModel) {
      const modelConfig = process.env.ANTHROPIC_MODEL?.toLowerCase() || 'haiku';
      const modelMap: { [key: string]: string } = {
        'haiku': 'claude-3-haiku-20240307',
        'sonnet': 'claude-3-5-sonnet-20241022'
      };
      selectedModel = modelMap[modelConfig] || modelMap['haiku'];
    }
    
    console.log(`Using model: ${selectedModel}`);

    // 並列処理で翻訳
    const translations = await translateWithParallelProcessing(
      texts,
      targetLanguage,
      selectedModel
    );

    const processingTime = Date.now() - startTime;
    console.log(`Translation completed in ${processingTime}ms for ${texts.length} texts`);

    // レスポンスヘッダーの設定
    const response = NextResponse.json({ 
      translations,
      stats: {
        totalTexts: texts.length,
        processingTimeMs: processingTime,
        model: selectedModel
      }
    });
    
    // キャッシュヘッダー
    response.headers.set('Cache-Control', 'private, max-age=3600');
    response.headers.set('X-Processing-Time', processingTime.toString());
    
    // 成功ログ
    logHttpRequest('POST', '/api/translate', 200, processingTime);
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    // AppErrorの場合はそのまま返す
    if (error instanceof AppError) {
      logger.logAppError(error);
      logHttpRequest('POST', '/api/translate', error.statusCode, duration, undefined, error);
      return NextResponse.json(error.toClientResponse(), { status: error.statusCode });
    }
    
    // Anthropic APIエラー
    if (error instanceof Anthropic.APIError) {
      let appError: AppError;
      
      if (error.status === 429) {
        appError = new AppError(
          'API rate limit exceeded',
          ErrorCodes.TRANSLATION_RATE_LIMITED,
          429,
          true,
          'APIレート制限に達しました。しばらくしてから再試行してください'
        );
      } else if (error.status === 401) {
        appError = new AppError(
          'Invalid API key',
          ErrorCodes.EXTERNAL_API_UNAUTHORIZED,
          401,
          false,
          'APIキーが無効です'
        );
      } else {
        appError = new AppError(
          error.message,
          ErrorCodes.TRANSLATION_API_ERROR,
          error.status || 500,
          true,
          `Claude APIエラー: ${error.message}`
        );
      }
      
      logger.logAppError(appError);
      logHttpRequest('POST', '/api/translate', appError.statusCode, duration, undefined, appError);
      return NextResponse.json(appError.toClientResponse(), { status: appError.statusCode });
    }
    
    // JSONパースエラー
    if (error instanceof SyntaxError) {
      const appError = new AppError(
        'Failed to parse response',
        ErrorCodes.TRANSLATION_API_ERROR,
        500,
        true,
        'Claudeからの応答を解析できませんでした'
      );
      logger.logAppError(appError);
      logHttpRequest('POST', '/api/translate', 500, duration, undefined, appError);
      return NextResponse.json(appError.toClientResponse(), { status: 500 });
    }
    
    // その他のエラー
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.TRANSLATION_FAILED,
      500,
      false,
      '翻訳中に予期しないエラーが発生しました'
    );
    logger.logAppError(appError);
    logHttpRequest('POST', '/api/translate', 500, duration, undefined, appError);
    return NextResponse.json(appError.toClientResponse(), { status: 500 });
  }
}
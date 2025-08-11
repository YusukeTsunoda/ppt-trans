import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { TextToTranslate, TranslatedText } from '@/types';
import { getTranslationCache } from '@/lib/translationCache';
import { validateTranslationRequest } from '@/lib/validationUtils';

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
    console.error('Batch translation error:', error);
    // エラー時は元のテキストを返す
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 入力検証
    const validation = validateTranslationRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { texts, targetLanguage, model } = validation.data!;

    // APIキーの確認
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is not set');
      return NextResponse.json(
        { error: 'APIキーが設定されていません。' },
        { status: 500 }
      );
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
    const startTime = Date.now();

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
    
    return response;

  } catch (error) {
    console.error("Translation API Error:", error);
    
    let errorMessage = '翻訳中に不明なエラーが発生しました。';
    let statusCode = 500;
    
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        errorMessage = 'APIレート制限に達しました。しばらくしてから再試行してください。';
        statusCode = 429;
      } else if (error.status === 401) {
        errorMessage = 'APIキーが無効です。設定を確認してください。';
        statusCode = 401;
      } else {
        errorMessage = `Claude APIエラー: ${error.message}`;
      }
    } else if (error instanceof SyntaxError) {
      errorMessage = 'Claudeからの応答を解析できませんでした。';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
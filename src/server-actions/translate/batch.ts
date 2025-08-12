'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { Anthropic } from '@anthropic-ai/sdk';
import { getTranslationCache } from '@/lib/translationCache';

// 翻訳リクエストのスキーマ
const translateRequestSchema = z.object({
  texts: z.array(z.object({
    id: z.string(),
    original: z.string(),
  })),
  targetLanguage: z.string(),
  model: z.string().optional().default('claude-3-haiku-20240307'),
});

/**
 * バッチ翻訳のServer Action
 * PreviewScreenから使用される
 */
export async function translateBatch(data: {
  texts: Array<{ id: string; original: string }>;
  targetLanguage: string;
  model?: string;
}) {
  const startTime = Date.now();
  
  try {
    // セッション確認（認証不要の場合はスキップ可能）
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    // バリデーション
    const validatedData = translateRequestSchema.parse(data);
    
    logger.info('Translation request', {
      textCount: validatedData.texts.length,
      targetLanguage: validatedData.targetLanguage,
      model: validatedData.model,
      userId,
    });
    
    // APIキーの確認
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'API key not configured',
        ErrorCodes.CONFIGURATION_ERROR,
        500,
        false,
        'APIキーが設定されていません'
      );
    }
    
    // キャッシュを確認
    const cache = getTranslationCache();
    const translations: Array<{ id: string; original: string; translated: string }> = [];
    const textsToTranslate: Array<{ id: string; original: string }> = [];
    
    for (const text of validatedData.texts) {
      const cacheKey = `${text.original}_${validatedData.targetLanguage}_${validatedData.model}`;
      const cached = cache.get(cacheKey, text.original, validatedData.targetLanguage);
      
      if (cached) {
        translations.push({
          id: text.id,
          original: text.original,
          translated: cached as string,
        });
      } else {
        textsToTranslate.push(text);
      }
    }
    
    logger.info('Translation cache status', {
      cached: translations.length,
      toTranslate: textsToTranslate.length,
    });
    
    // 翻訳が必要なテキストがある場合
    if (textsToTranslate.length > 0) {
      const anthropic = new Anthropic({ apiKey });
      
      // バッチサイズ
      const batchSize = 20;
      const batches = [];
      
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        batches.push(textsToTranslate.slice(i, i + batchSize));
      }
      
      logger.info(`Processing ${batches.length} batches in parallel (max 3 at a time)`);
      
      // 並列処理（最大3バッチ同時）
      const maxConcurrent = 3;
      const results = [];
      
      for (let i = 0; i < batches.length; i += maxConcurrent) {
        const concurrentBatches = batches.slice(i, i + maxConcurrent);
        const batchPromises = concurrentBatches.map(async (batch) => {
          const prompt = `
You are a professional translator specializing in PowerPoint presentations.
Translate the following texts while maintaining:
1. Professional tone appropriate for presentations
2. Technical terms accuracy
3. Conciseness for slide readability
4. Cultural appropriateness

Target Language: ${validatedData.targetLanguage}

IMPORTANT: Return ONLY a valid JSON array with the exact same structure as input.
Each object must have: id, original, and translated fields.
Do not include any explanations or markdown formatting.

Input JSON:
${JSON.stringify(batch)}

Output JSON:`;
          
          try {
            const response = await anthropic.messages.create({
              model: validatedData.model,
              max_tokens: 4096,
              temperature: 0.3,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
            });
            
            const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
            
            // JSONレスポンスを解析
            const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const translatedBatch = JSON.parse(cleanedResponse);
            
            // キャッシュに保存
            for (const item of translatedBatch) {
              const cacheKey = `${item.original}_${validatedData.targetLanguage}_${validatedData.model}`;
              cache.set(cacheKey, item.translated, item.original, validatedData.targetLanguage);
            }
            
            return translatedBatch;
          } catch (error) {
            logger.error('Batch translation error', { error, batch });
            // エラーの場合は元のテキストを返す
            return batch.map(item => ({
              ...item,
              translated: item.original,
            }));
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat());
      }
      
      translations.push(...results);
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Translation completed in ${duration}ms for ${validatedData.texts.length} texts`);
    
    return {
      success: true,
      translations,
    };
    
  } catch (error) {
    logger.error('Translation error', error);
    
    const appError = error instanceof AppError ? error : new AppError(
      error instanceof Error ? error.message : 'Translation failed',
      ErrorCodes.TRANSLATION_API_ERROR,
      500,
      false,
      '翻訳処理中にエラーが発生しました'
    );
    
    return {
      success: false,
      error: appError.userMessage || '翻訳に失敗しました',
      translations: [],
    };
  }
}
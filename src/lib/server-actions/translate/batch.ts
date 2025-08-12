'use server';

import logger from '@/lib/logger';
import { ServerActionState } from '../types';
import { TranslationManager } from '@/lib/translation/TranslationManager';

export interface TranslationResult {
  translatedTexts: string[];
  count: number;
  sourceLang: string;
  targetLang: string;
}

/**
 * バッチ翻訳 Server Action
 * useActionStateと互換性のある形式
 */
export async function batchTranslate(
  _prevState: ServerActionState<TranslationResult>,
  formData: FormData
): Promise<ServerActionState<TranslationResult>> {
  try {
    const data = Object.fromEntries(formData.entries());
    const texts = JSON.parse(data.texts as string) as string[];
    const sourceLang = data.sourceLang as string || 'auto';
    const targetLang = data.targetLang as string || 'en';

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!apiKey) {
      logger.warn('Anthropic API key not configured, using mock translation');
      // モックモード
      const translatedTexts = texts.map(text => {
        if (targetLang === 'Japanese' || targetLang === 'ja') {
          return text;
        } else if (targetLang === 'English' || targetLang === 'en') {
          return `[EN] ${text}`;
        } else if (targetLang === 'Chinese' || targetLang === 'zh') {
          return `[中文] ${text}`;
        } else if (targetLang === 'Korean' || targetLang === 'ko') {
          return `[한국어] ${text}`;
        } else {
          return `[${targetLang}] ${text}`;
        }
      });
      
      return {
        success: true,
        data: {
          translatedTexts,
          count: translatedTexts.length,
          sourceLang,
          targetLang,
        },
        message: '翻訳が完了しました（モックモード）',
        
      };
    }
    
    // TranslationManagerを使用してバッチ翻訳
    try {
      const translatedTexts = await TranslationManager.translateBatch(
        texts,
        apiKey,
        {
          model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
          targetLanguage: targetLang,
          sourceLanguage: sourceLang,
        }
      );
      
      logger.info('Batch translation completed', {
        count: texts.length,
        sourceLang,
        targetLang,
      });
      
      return {
        success: true,
        data: {
          translatedTexts,
          count: translatedTexts.length,
          sourceLang,
          targetLang,
        },
        message: '翻訳が完了しました',
        
      };
    } catch (translationError) {
      logger.error('Translation error', translationError);
      throw translationError;
    }

  } catch (error) {
    logger.error('Batch translation error', error);
    return {
      success: false,
      message: '翻訳処理中にエラーが発生しました',
      
    };
  }
}
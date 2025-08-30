'use server';

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';
import { 
  translateTextsSchema, 
  validateInput,
  type TextItem,
  type TranslateTextsInput 
} from '@/lib/validation/server-actions';
import { createRateLimiter } from '@/lib/security/rate-limiter';

// Anthropic APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface TranslationItem {
  id: string;
  original: string;
  translated: string;
}

export interface TranslateTextsResult {
  success: boolean;
  translations?: TranslationItem[];
  error?: string;
}

/**
 * テキストを指定された言語に翻訳する
 * @param texts 翻訳するテキストの配列
 * @param targetLanguage 翻訳先の言語コード
 * @returns 翻訳結果
 */
export async function translateTextsAction(
  texts: unknown,
  targetLanguage: unknown
): Promise<TranslateTextsResult> {
  try {
    // 入力検証
    const validation = validateInput(translateTextsSchema, { texts, targetLanguage });
    if (!validation.success) {
      return {
        success: false,
        error: `入力エラー: ${validation.error}`
      };
    }
    
    const validatedData = validation.data;
    
    // Supabaseクライアントを作成
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // レート制限チェック
    const rateLimiter = createRateLimiter('translateTexts', user.id);
    const rateLimit = await rateLimiter();
    
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `レート制限に達しました。${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)}秒後に再試行してください。`
      };
    }
    
    // 言語マッピング
    const languageMap: { [key: string]: string } = {
      'ja': 'Japanese',
      'en': 'English',
      'zh': 'Chinese',
      'ko': 'Korean',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
    };
    
    const targetLang = languageMap[validatedData.targetLanguage] || 'Japanese';
    
    // 翻訳処理
    const translations: TranslationItem[] = [];
    
    for (const item of validatedData.texts) {
      try {
        // Claude APIを使用して翻訳
        const message = await anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1000,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `Translate the following text to ${targetLang}. Return only the translated text without any explanation or additional comments.

Text to translate: ${item.text}

Translation:`
            }
          ]
        });
        
        const translatedText = message.content[0].type === 'text' 
          ? message.content[0].text.trim() 
          : item.text;
        
        translations.push({
          id: item.id,
          original: item.text,
          translated: translatedText,
        });
        
      } catch (err) {
        logger.error('Translation error for item:', err, { item });
        // エラーが発生した場合は元のテキストをそのまま返す
        translations.push({
          id: item.id,
          original: item.text,
          translated: item.text,
        });
      }
    }
    
    return {
      success: true,
      translations,
    };
    
  } catch (error) {
    logger.error('Translate action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '翻訳処理中にエラーが発生しました'
    };
  }
}
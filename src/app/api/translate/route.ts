import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

// Anthropic APIクライアントの初期化
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    const { texts, targetLanguage } = await request.json();
    
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'テキストが指定されていません' },
        { status: 400 }
      );
    }
    
    // Supabaseクライアントを作成
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
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
    
    const targetLang = languageMap[targetLanguage] || 'Japanese';
    
    // 翻訳処理
    const translations = [];
    
    for (const item of texts) {
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

Text to translate: "${item.text}"

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
    
    return NextResponse.json({
      success: true,
      translations,
    });
    
  } catch (error) {
    logger.error('Translate API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '翻訳処理中にエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}
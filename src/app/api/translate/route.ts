import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, model, targetLanguage, sourceLanguage, systemPrompt, isBatch } = body;

    // 言語パラメータの検証
    if (!targetLanguage || !sourceLanguage) {
      return NextResponse.json(
        { error: 'Source and target languages are required' },
        { status: 400 }
      );
    }

    // APIキーの確認
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Translation service not configured' },
        { status: 500 }
      );
    }

    // Anthropic APIクライアントを初期化
    const anthropic = new Anthropic({
      apiKey,
    });

    // 翻訳を実行
    const response = await anthropic.messages.create({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: systemPrompt || `You are a professional translator. Translate from ${sourceLanguage} to ${targetLanguage}. Maintain the original formatting and style.`,
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
    });

    // レスポンスを取得
    const translatedText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    logger.info('Translation completed', {
      model,
      targetLanguage,
      sourceLanguage,
      textLength: text.length,
      isBatch,
    });

    return NextResponse.json({ translatedText });
  } catch (error) {
    logger.error('Translation API error', error);
    
    // エラーレスポンス
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    );
  }
}
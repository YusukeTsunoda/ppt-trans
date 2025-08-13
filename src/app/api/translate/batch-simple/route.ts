import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import logger from '@/lib/logger';
import { requireAuth } from '@/lib/auth-helpers';

interface TranslationRequest {
  texts: Array<{
    id: string;
    original: string;
  }>;
  targetLanguage?: string;
  sourceLanguage?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  // 認証チェック
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const user = authResult;

  // レート制限は別途実装が必要な場合は追加
  // 現在は基本的な認証のみ

  try {
    const body: TranslationRequest = await request.json();
    const { 
      texts, 
      targetLanguage, 
      sourceLanguage,
      model = 'claude-3-haiku-20240307'
    } = body;

    // 入力検証
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No texts provided for translation' 
        },
        { status: 400 }
      );
    }

    // 言語パラメータの検証
    if (!targetLanguage) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Target language is required' 
        },
        { status: 400 }
      );
    }
    
    // sourceLanguageがない場合やautoの場合は自動検出
    const effectiveSourceLanguage = (!sourceLanguage || sourceLanguage === 'auto') 
      ? 'the source language' 
      : sourceLanguage;

    // APIキーの確認
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      logger.error('ANTHROPIC_API_KEY not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'Translation service not configured' 
        },
        { status: 500 }
      );
    }

    // Anthropic APIクライアントを初期化
    const anthropic = new Anthropic({
      apiKey,
    });

    // バッチ形式のプロンプトを作成
    const batchPrompt = texts
      .map((text, index) => `[TEXT_${index}]\n${text.original}\n[/TEXT_${index}]`)
      .join('\n\n');

    const systemPrompt = `You are a professional translator specializing in PowerPoint presentations. 
Translate each text block from ${effectiveSourceLanguage} to ${targetLanguage}.
${(!sourceLanguage || sourceLanguage === 'auto') ? 'Automatically detect the source language of each text.' : ''}
Maintain the original formatting, style, and presentation context.
Return the translations in the same format with [TRANSLATION_N] tags.
Keep technical terms, proper nouns, and acronyms as appropriate for the target language.

Example format:
[TRANSLATION_0]
翻訳されたテキスト
[/TRANSLATION_0]

[TRANSLATION_1]
別の翻訳されたテキスト
[/TRANSLATION_1]`;

    logger.info('Starting batch translation', {
      model,
      targetLanguage,
      sourceLanguage: sourceLanguage || 'auto',
      textCount: texts.length,
      totalCharacters: batchPrompt.length
    });

    // 翻訳を実行
    const response = await anthropic.messages.create({
      model,
      max_tokens: model.includes('haiku') ? 4096 : 8192, // Haikuは4096、Sonnetは8192まで
      temperature: 0.3, // より一貫性のある翻訳のため低めに設定
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: batchPrompt,
        },
      ],
    });

    // レスポンスを取得
    const responseText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // バッチ応答をパース
    const translations = [];
    for (let i = 0; i < texts.length; i++) {
      const regex = new RegExp(`\\[TRANSLATION_${i}\\]([\\s\\S]*?)\\[/TRANSLATION_${i}\\]`);
      const match = responseText.match(regex);
      
      if (match && match[1]) {
        translations.push({
          id: texts[i].id,
          translated: match[1].trim()
        });
      } else {
        // パースに失敗した場合は元のテキストを返す（エラーを避けるため）
        logger.warn(`Failed to parse translation for index ${i}, using fallback`);
        
        // 個別に翻訳を試みる（フォールバック）
        try {
          const fallbackResponse = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            temperature: 0.3,
            system: `Translate from ${sourceLanguage} to ${targetLanguage}. Maintain formatting and style.`,
            messages: [
              {
                role: 'user',
                content: texts[i].original,
              },
            ],
          });
          
          const fallbackText = fallbackResponse.content[0].type === 'text'
            ? fallbackResponse.content[0].text
            : texts[i].original;
            
          translations.push({
            id: texts[i].id,
            translated: fallbackText.trim()
          });
        } catch (fallbackError) {
          logger.error(`Fallback translation failed for text ${i}`, fallbackError);
          translations.push({
            id: texts[i].id,
            translated: texts[i].original // 最終的なフォールバック
          });
        }
      }
    }

    logger.info('Batch translation completed', {
      model,
      requestedCount: texts.length,
      translatedCount: translations.length,
      successRate: `${(translations.length / texts.length * 100).toFixed(1)}%`
    });

    return NextResponse.json({ 
      success: true,
      translations,
      model,
      targetLanguage
    });

  } catch (error) {
    logger.error('Batch translation API error', error);
    
    // エラーレスポンス
    if (error instanceof Anthropic.APIError) {
      // APIレート制限の場合
      if (error.status === 429) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter: error.headers?.['retry-after']
          },
          { status: 429 }
        );
      }
      
      // その他のAPIエラー
      return NextResponse.json(
        { 
          success: false,
          error: error.message 
        },
        { status: error.status || 500 }
      );
    }
    
    // 一般的なエラー
    return NextResponse.json(
      { 
        success: false,
        error: 'Translation failed. Please try again.' 
      },
      { status: 500 }
    );
  }
}

// OPTIONS リクエストのサポート（CORS対応）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
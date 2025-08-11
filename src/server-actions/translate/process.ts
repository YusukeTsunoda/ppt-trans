'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { Anthropic } from '@anthropic-ai/sdk';
import { revalidatePath } from 'next/cache';
import { ReadableStream } from 'stream/web';

// 翻訳テキストのスキーマ
const translateTextSchema = z.object({
  text: z.string().min(1, 'テキストを入力してください').max(10000, 'テキストは10000文字以内で入力してください'),
  targetLanguage: z.enum(['Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']),
  sourceLanguage: z.enum(['auto', 'Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']).default('auto'),
  model: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']).default('claude-3-sonnet-20240229'),
  preserveFormatting: z.boolean().default(true),
  glossary: z.record(z.string()).optional(),
});

// バッチ翻訳のスキーマ
const batchTranslateSchema = z.object({
  texts: z.array(z.object({
    id: z.string(),
    text: z.string().min(1).max(10000),
  })).min(1).max(100),
  targetLanguage: z.enum(['Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']),
  sourceLanguage: z.enum(['auto', 'Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']).default('auto'),
  model: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']).default('claude-3-sonnet-20240229'),
  batchSize: z.number().min(1).max(50).default(10),
});

// PPTXファイル翻訳のスキーマ
const translatePptxSchema = z.object({
  fileId: z.string().uuid(),
  targetLanguage: z.enum(['Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']),
  sourceLanguage: z.enum(['auto', 'Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']).default('auto'),
  model: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']).default('claude-3-sonnet-20240229'),
  preserveFormatting: z.boolean().default(true),
  translateTables: z.boolean().default(true),
  translateCharts: z.boolean().default(false),
  translateNotes: z.boolean().default(true),
});

// 翻訳ジョブのスキーマ
const translationJobSchema = z.object({
  fileId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  totalSlides: z.number(),
  processedSlides: z.number(),
  totalTexts: z.number(),
  processedTexts: z.number(),
  errors: z.array(z.string()).optional(),
});

/**
 * Anthropic APIクライアントを取得
 */
async function getAnthropicClient(userId?: string) {
  let apiKey = process.env.ANTHROPIC_API_KEY;

  // ユーザー固有のAPIキーがあれば使用
  if (userId) {
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId },
      select: { apiSettings: true },
    });

    if (userSettings?.apiSettings && typeof userSettings.apiSettings === 'object' && 'anthropicApiKey' in userSettings.apiSettings) {
      apiKey = userSettings.apiSettings.anthropicApiKey as string || apiKey;
    }
  }

  if (!apiKey) {
    throw new AppError(
      'API key not configured',
      ErrorCodes.CONFIGURATION_ERROR,
      500,
      false,
      'APIキーが設定されていません'
    );
  }

  return new Anthropic({ apiKey });
}

/**
 * 単一テキストを翻訳
 */
export async function translateText(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      text: formData.get('text') as string,
      targetLanguage: formData.get('targetLanguage') as string,
      sourceLanguage: formData.get('sourceLanguage') as string || 'auto',
      model: formData.get('model') as string || 'claude-3-sonnet-20240229',
      preserveFormatting: formData.get('preserveFormatting') === 'true',
      glossary: formData.get('glossary') ? JSON.parse(formData.get('glossary') as string) : undefined,
    };

    // バリデーション
    const validatedData = translateTextSchema.parse(data);

    // Anthropic APIクライアントを取得
    const anthropic = await getAnthropicClient(session.user.id);

    // プロンプトを構築
    const systemPrompt = `You are a professional translator. Translate the following text from ${validatedData.sourceLanguage === 'auto' ? 'the detected language' : validatedData.sourceLanguage} to ${validatedData.targetLanguage}.
${validatedData.preserveFormatting ? 'Preserve the original formatting, including line breaks and spacing.' : ''}
${validatedData.glossary ? `Use the following glossary for consistent translations: ${JSON.stringify(validatedData.glossary)}` : ''}
Provide only the translated text without any additional explanation.`;

    // 翻訳を実行
    const response = await anthropic.messages.create({
      model: validatedData.model,
      max_tokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: validatedData.text,
        },
      ],
    });

    const translatedText = response.content[0].type === 'text' ? response.content[0].text : '';

    // 翻訳履歴を保存
    await prisma.translationHistory.create({
      data: {
        userId: session.user.id,
        sourceText: validatedData.text,
        translatedText,
        sourceLanguage: validatedData.sourceLanguage,
        targetLanguage: validatedData.targetLanguage,
        model: validatedData.model,
        tokenCount: response.usage?.input_tokens || 0,
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TRANSLATE',
        entityType: 'text',
        entityId: 'single',
        metadata: {
          textLength: validatedData.text.length,
          targetLanguage: validatedData.targetLanguage,
          model: validatedData.model,
          tokenCount: response.usage?.input_tokens || 0,
        },
      },
    });

    logger.info('Text translated successfully', {
      userId: session.user.id,
      textLength: validatedData.text.length,
      targetLanguage: validatedData.targetLanguage,
    });

    return {
      success: true,
      data: {
        translatedText,
        detectedLanguage: validatedData.sourceLanguage === 'auto' ? 'unknown' : validatedData.sourceLanguage,
        tokenCount: response.usage?.input_tokens || 0,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'テキストの翻訳に失敗しました',
      };
    }

    logger.error('Failed to translate text', error);
    return {
      success: false,
      error: 'テキストの翻訳に失敗しました',
    };
  }
}

/**
 * バッチ翻訳を実行
 */
export async function batchTranslate(data: z.infer<typeof batchTranslateSchema>) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // バリデーション
    const validatedData = batchTranslateSchema.parse(data);

    // Anthropic APIクライアントを取得
    const anthropic = await getAnthropicClient(session.user.id);

    // バッチ処理
    const results = [];
    const batches = [];
    
    // テキストをバッチに分割
    for (let i = 0; i < validatedData.texts.length; i += validatedData.batchSize) {
      batches.push(validatedData.texts.slice(i, i + validatedData.batchSize));
    }

    // 各バッチを処理
    for (const batch of batches) {
      const batchPrompt = batch.map(item => `[ID:${item.id}]\n${item.text}`).join('\n\n---\n\n');
      
      const systemPrompt = `You are a professional translator. Translate the following texts from ${validatedData.sourceLanguage === 'auto' ? 'the detected language' : validatedData.sourceLanguage} to ${validatedData.targetLanguage}.
Each text is prefixed with an ID in the format [ID:xxx]. Maintain this format in your response.
Provide translations in the same order, using the format:
[ID:xxx]
Translated text here

---`;

      const response = await anthropic.messages.create({
        model: validatedData.model,
        max_tokens: 8192,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: batchPrompt,
          },
        ],
      });

      // レスポンスを解析
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      const translations = responseText.split('---').map(section => {
        const match = section.match(/\[ID:([^\]]+)\]\s*([\s\S]*)/);
        if (match) {
          return {
            id: match[1].trim(),
            translatedText: match[2].trim(),
          };
        }
        return null;
      }).filter(Boolean);

      results.push(...translations);
    }

    // 翻訳履歴を保存
    for (const result of results) {
      const original = validatedData.texts.find(t => t.id === result?.id);
      if (original && result) {
        await prisma.translationHistory.create({
          data: {
            userId: session.user.id,
            sourceText: original.text,
            translatedText: result.translatedText,
            sourceLanguage: validatedData.sourceLanguage,
            targetLanguage: validatedData.targetLanguage,
            model: validatedData.model,
          },
        });
      }
    }

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TRANSLATE',
        entityType: 'batch',
        entityId: 'batch',
        metadata: {
          textCount: validatedData.texts.length,
          targetLanguage: validatedData.targetLanguage,
          model: validatedData.model,
          batchSize: validatedData.batchSize,
        },
      },
    });

    logger.info('Batch translation completed', {
      userId: session.user.id,
      textCount: validatedData.texts.length,
      targetLanguage: validatedData.targetLanguage,
    });

    return {
      success: true,
      data: {
        translations: results,
        totalCount: validatedData.texts.length,
        successCount: results.length,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'バッチ翻訳に失敗しました',
      };
    }

    logger.error('Failed to batch translate', error);
    return {
      success: false,
      error: 'バッチ翻訳に失敗しました',
    };
  }
}

/**
 * PPTXファイルを翻訳（非同期ジョブとして実行）
 */
export async function translatePptxFile(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    // FormDataをオブジェクトに変換
    const data = {
      fileId: formData.get('fileId') as string,
      targetLanguage: formData.get('targetLanguage') as string,
      sourceLanguage: formData.get('sourceLanguage') as string || 'auto',
      model: formData.get('model') as string || 'claude-3-sonnet-20240229',
      preserveFormatting: formData.get('preserveFormatting') === 'true',
      translateTables: formData.get('translateTables') === 'true',
      translateCharts: formData.get('translateCharts') === 'true',
      translateNotes: formData.get('translateNotes') === 'true',
    };

    // バリデーション
    const validatedData = translatePptxSchema.parse(data);

    // ファイルの存在確認
    const file = await prisma.file.findUnique({
      where: { id: validatedData.fileId },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!file) {
      throw new AppError(
        'File not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // 権限確認
    if (file.user.id !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'このファイルへのアクセス権限がありません'
      );
    }

    // 翻訳ジョブを作成
    const job = await prisma.translationJob.create({
      data: {
        fileId: validatedData.fileId,
        userId: session.user.id,
        status: 'pending',
        targetLanguage: validatedData.targetLanguage,
        sourceLanguage: validatedData.sourceLanguage,
        model: validatedData.model,
        options: {
          preserveFormatting: validatedData.preserveFormatting,
          translateTables: validatedData.translateTables,
          translateCharts: validatedData.translateCharts,
          translateNotes: validatedData.translateNotes,
        },
      },
    });

    // 非同期で翻訳処理を開始（実際にはジョブキューに追加）
    // ここでは簡易的に直接実行
    processTranslationJob(job.id).catch(error => {
      logger.error('Translation job failed', { jobId: job.id, error });
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'TRANSLATE',
        entityType: 'pptx',
        entityId: validatedData.fileId,
        metadata: {
          jobId: job.id,
          targetLanguage: validatedData.targetLanguage,
          model: validatedData.model,
        },
      },
    });

    logger.info('PPTX translation job created', {
      userId: session.user.id,
      fileId: validatedData.fileId,
      jobId: job.id,
    });

    return {
      success: true,
      data: {
        jobId: job.id,
        status: 'pending',
        message: '翻訳処理を開始しました',
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors[0].message,
      };
    }

    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'PPTXファイルの翻訳に失敗しました',
      };
    }

    logger.error('Failed to translate PPTX file', error);
    return {
      success: false,
      error: 'PPTXファイルの翻訳に失敗しました',
    };
  }
}

/**
 * 翻訳ジョブのステータスを取得
 */
export async function getTranslationJobStatus(jobId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    const job = await prisma.translationJob.findUnique({
      where: { id: jobId },
      include: {
        file: {
          select: {
            fileName: true,
            fileSize: true,
          },
        },
      },
    });

    if (!job) {
      throw new AppError(
        'Job not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ジョブが見つかりません'
      );
    }

    // 権限確認
    if (job.userId !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'このジョブへのアクセス権限がありません'
      );
    }

    return {
      success: true,
      data: {
        id: job.id,
        status: job.status,
        progress: job.progress || 0,
        fileName: job.file.fileName,
        fileSize: job.file.fileSize,
        targetLanguage: job.targetLanguage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ジョブステータスの取得に失敗しました',
      };
    }

    logger.error('Failed to get job status', error);
    return {
      success: false,
      error: 'ジョブステータスの取得に失敗しました',
    };
  }
}

/**
 * 翻訳ジョブをキャンセル
 */
export async function cancelTranslationJob(jobId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new AppError(
        'Unauthorized',
        ErrorCodes.AUTH_UNAUTHORIZED,
        401,
        true,
        '認証が必要です'
      );
    }

    const job = await prisma.translationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new AppError(
        'Job not found',
        ErrorCodes.NOT_FOUND,
        404,
        true,
        'ジョブが見つかりません'
      );
    }

    // 権限確認
    if (job.userId !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_FORBIDDEN,
        403,
        true,
        'このジョブへのアクセス権限がありません'
      );
    }

    // ジョブをキャンセル
    if (job.status === 'pending' || job.status === 'processing') {
      await prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
        },
      });

      // 監査ログを記録
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'CANCEL',
          entityType: 'translation_job',
          entityId: jobId,
        },
      });

      logger.info('Translation job cancelled', {
        userId: session.user.id,
        jobId,
      });

      return {
        success: true,
        message: '翻訳ジョブをキャンセルしました',
      };
    } else {
      return {
        success: false,
        error: 'このジョブはキャンセルできません',
      };
    }
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'ジョブのキャンセルに失敗しました',
      };
    }

    logger.error('Failed to cancel job', error);
    return {
      success: false,
      error: 'ジョブのキャンセルに失敗しました',
    };
  }
}

/**
 * 翻訳ジョブを処理（内部関数）
 */
async function processTranslationJob(jobId: string) {
  try {
    // ジョブを取得
    const job = await prisma.translationJob.findUnique({
      where: { id: jobId },
      include: {
        file: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // ステータスを処理中に更新
    await prisma.translationJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    // TODO: 実際の翻訳処理を実装
    // 1. PPTXファイルを解析
    // 2. テキストを抽出
    // 3. バッチ翻訳を実行
    // 4. 翻訳結果を適用
    // 5. 新しいPPTXファイルを生成

    // 仮の進捗更新
    for (let i = 0; i <= 100; i += 10) {
      await prisma.translationJob.update({
        where: { id: jobId },
        data: { progress: i },
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 完了
    await prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      },
    });

    logger.info('Translation job completed', { jobId });
  } catch (error) {
    logger.error('Translation job failed', { jobId, error });

    await prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}

/**
 * ストリーミング翻訳（実験的）
 */
export async function* streamTranslate(text: string, targetLanguage: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AppError(
      'Unauthorized',
      ErrorCodes.AUTH_UNAUTHORIZED,
      401,
      true,
      '認証が必要です'
    );
  }

  const anthropic = await getAnthropicClient(session.user.id);

  const stream = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4096,
    temperature: 0.3,
    stream: true,
    system: `Translate to ${targetLanguage}. Provide only the translation.`,
    messages: [
      {
        role: 'user',
        content: text,
      },
    ],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      yield chunk.delta.text;
    }
  }
}
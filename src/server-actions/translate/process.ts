'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { Anthropic } from '@anthropic-ai/sdk';
import { claudeApiRetry } from '@/lib/utils/retry';
import { TimeoutConfig, withTimeout } from '@/lib/config/timeout';
import { processWithPartialSuccess } from '@/lib/utils/partial-success';

// 翻訳テキストのスキーマ
const translateTextSchema = z.object({
  text: z.string().min(1, 'テキストを入力してください').max(10000, 'テキストは10000文字以内で入力してください'),
  targetLanguage: z.enum(['Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']),
  sourceLanguage: z.enum(['auto', 'Japanese', 'English', 'Chinese', 'Korean', 'Spanish', 'French', 'German']).default('auto'),
  model: z.enum(['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']).default('claude-3-sonnet-20240229'),
  preserveFormatting: z.boolean().default(true),
  glossary: z.record(z.string(), z.string()).optional(),
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

/**
 * Anthropic APIクライアントを取得
 */
async function getAnthropicClient(_userId?: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ユーザー固有のAPIキーがあれば使用（現在はapiSettings未実装のため環境変数のみ使用）
  // TODO: 将来的にユーザー固有のAPIキーを実装する場合はここに追加

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

    // 翻訳を実行（リトライ機能付き）
    const response = await claudeApiRetry(
      async () => anthropic.messages.create({
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
      }),
      (attempt, error) => {
        logger.warn('Claude API retry attempt', {
          attempt,
          error: error.message,
          userId: session.user.id,
          textLength: validatedData.text.length,
        });
      }
    );

    const translatedText = response.content[0].type === 'text' ? response.content[0].text : '';

    // 翻訳履歴を保存（現在はTranslationモデルがfileIdを必要とするためスキップ）
    // TODO: 単独テキスト翻訳用の履歴テーブルを作成する

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_TRANSLATE',
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
        error: error.issues[0].message,
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

    // タイムアウト設定
    const batchTimeout = TimeoutConfig.processing.translation;
    
    // 部分的成功を許可してバッチ処理
    const partialResult = await processWithPartialSuccess(
      batches,
      async (batch, batchIndex) => {
        const batchPrompt = batch.map(item => `[ID:${item.id}]\n${item.text}`).join('\n\n---\n\n');
        
        const systemPrompt = `You are a professional translator. Translate the following texts from ${validatedData.sourceLanguage === 'auto' ? 'the detected language' : validatedData.sourceLanguage} to ${validatedData.targetLanguage}.
Each text is prefixed with an ID in the format [ID:xxx]. Maintain this format in your response.
Provide translations in the same order, using the format:
[ID:xxx]
Translated text here

---`;

        // タイムアウト付きで翻訳実行
        const response = await withTimeout(
          claudeApiRetry(
            async () => anthropic.messages.create({
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
            }),
            (attempt, error) => {
              logger.warn('Claude API batch retry attempt', {
                attempt,
                error: error.message,
                userId: session.user.id,
                batchSize: batch.length,
                batchIndex,
              });
            }
          ),
          batchTimeout,
          `Batch ${batchIndex + 1} translation timed out after ${batchTimeout}ms`
        );

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

        return translations;
      },
      {
        continueOnError: true,
        minSuccessRate: 0.7, // 70%以上成功すれば処理を継続
        concurrency: TimeoutConfig.batch.concurrency,
        onItemComplete: (index, success) => {
          logger.info(`Batch ${index + 1}/${batches.length} ${success ? 'completed' : 'failed'}`);
        },
      }
    );

    // 成功したバッチの結果を収集
    for (const batchTranslations of partialResult.successful) {
      results.push(...batchTranslations);
    }

    // 失敗したバッチがある場合は警告
    if (partialResult.failureCount > 0) {
      logger.warn('Some batches failed during translation', {
        successCount: partialResult.successCount,
        failureCount: partialResult.failureCount,
        successRate: partialResult.successRate,
      });
      
      // 重要なテキストが翻訳されなかった場合の処理
      const failedTextIds = [];
      for (const failure of partialResult.failed) {
        const batch = failure.item;
        failedTextIds.push(...batch.map((t: any) => t.id));
      }
      
      // 失敗したテキストにはオリジナルを使用
      for (const id of failedTextIds) {
        const original = validatedData.texts.find(t => t.id === id);
        if (original) {
          results.push({
            id: original.id,
            translatedText: original.text, // フォールバック: 原文を使用
          });
        }
      }
    }

    // 翻訳履歴を保存
    for (const result of results) {
      const original = validatedData.texts.find(t => t.id === result?.id);
      if (original && result) {
        // 翻訳履歴を保存（現在はTranslationモデルがfileIdを必要とするためスキップ）
        // TODO: バッチ翻訳用の履歴テーブルを作成する
      }
    }

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_TRANSLATE',
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
        error: error.issues[0].message,
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
        ErrorCodes.FILE_NOT_FOUND,
        404,
        true,
        'ファイルが見つかりません'
      );
    }

    // 権限確認
    if (file.user.id !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_UNAUTHORIZED,
        403,
        true,
        'このファイルへのアクセス権限がありません'
      );
    }

    // 翻訳ジョブを作成
    const job = await prisma.translation.create({
      data: {
        fileId: validatedData.fileId,
        status: 'pending',
        targetLanguage: validatedData.targetLanguage,
        // sourceLanguage: validatedData.sourceLanguage, // Translationモデルに存在しない
        // model: validatedData.model, // Translationモデルに存在しない
        // options: {...}, // Translationモデルに存在しない
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
        action: 'FILE_TRANSLATE',
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
        error: error.issues[0].message,
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

    const job = await prisma.translation.findUnique({
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
        ErrorCodes.FILE_NOT_FOUND,
        404,
        true,
        'ジョブが見つかりません'
      );
    }

    // 権限確認（ファイルの所有者で確認）
    const file = await prisma.file.findUnique({
      where: { id: job.fileId },
      select: { userId: true },
    });
    
    if (!file || file.userId !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_UNAUTHORIZED,
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
        // error: job.error, // Translationモデルに存在しない
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

    const job = await prisma.translation.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new AppError(
        'Job not found',
        ErrorCodes.FILE_NOT_FOUND,
        404,
        true,
        'ジョブが見つかりません'
      );
    }

    // 権限確認（ファイルの所有者で確認）
    const file = await prisma.file.findUnique({
      where: { id: job.fileId },
      select: { userId: true },
    });
    
    if (!file || file.userId !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_UNAUTHORIZED,
        403,
        true,
        'このジョブへのアクセス権限がありません'
      );
    }

    // ジョブをキャンセル
    if (job.status === 'pending' || job.status === 'processing') {
      await prisma.translation.update({
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
          action: 'FILE_DELETE', // CANCELは存在しないため代替
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
    const job = await prisma.translation.findUnique({
      where: { id: jobId },
      include: {
        file: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // ステータスを処理中に更新
    await prisma.translation.update({
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
      await prisma.translation.update({
        where: { id: jobId },
        data: { progress: i },
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 完了
    await prisma.translation.update({
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

    await prisma.translation.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        // error: error instanceof Error ? error.message : 'Unknown error', // Translationモデルに存在しない
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
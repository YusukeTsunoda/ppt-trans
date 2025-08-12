'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabaseClient';

const execAsync = promisify(exec);

// PPTX生成のスキーマ
const generatePptxSchema = z.object({
  fileId: z.string().uuid(),
  translatedTexts: z.array(z.object({
    slideNumber: z.number(),
    textId: z.string(),
    originalText: z.string(),
    translatedText: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }).optional(),
  })),
  options: z.object({
    preserveFormatting: z.boolean().default(true),
    preserveLayout: z.boolean().default(true),
    preserveImages: z.boolean().default(true),
    preserveAnimations: z.boolean().default(false),
    watermark: z.string().optional(),
    compression: z.boolean().default(true),
  }).optional(),
});

// テンプレートからPPTX生成のスキーマ
const generateFromTemplateSchema = z.object({
  templateId: z.string(),
  data: z.record(z.string(), z.any()),
  outputFormat: z.enum(['pptx', 'pdf', 'images']).default('pptx'),
});

// バッチPPTX生成のスキーマ
const batchGenerateSchema = z.object({
  jobs: z.array(z.object({
    id: z.string(),
    fileId: z.string().uuid(),
    translatedTexts: z.array(z.object({
      slideNumber: z.number(),
      textId: z.string(),
      translatedText: z.string(),
    })),
  })).min(1).max(10),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

/**
 * PPTXファイルを生成（FormData版）
 */
export async function generatePptxFormData(formData: FormData) {
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
      translatedTexts: JSON.parse(formData.get('translatedTexts') as string || '[]'),
      options: formData.get('options') ? JSON.parse(formData.get('options') as string) : undefined,
    };

    // バリデーション
    const validatedData = generatePptxSchema.parse(data);

    // ファイルの存在確認と権限チェック
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

    if (file.user.id !== session.user.id) {
      throw new AppError(
        'Forbidden',
        ErrorCodes.AUTH_UNAUTHORIZED,
        403,
        true,
        'このファイルへのアクセス権限がありません'
      );
    }

    // Translationモデルを使用して生成ジョブを作成
    const job = await prisma.translation.create({
      data: {
        fileId: validatedData.fileId,
        status: 'pending',
        targetLanguage: 'PPTX_GENERATION', // PPTX生成ジョブであることを示す
        originalText: JSON.stringify({
          translatedTexts: validatedData.translatedTexts,
          options: validatedData.options,
        }),
        progress: 0,
      },
    });

    // 非同期で生成処理を開始
    processGenerationJob(job.id).catch(error => {
      logger.error('Generation job failed', { jobId: job.id, error });
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_UPLOAD',
        entityType: 'pptx',
        entityId: validatedData.fileId,
        metadata: {
          jobId: job.id,
          textCount: validatedData.translatedTexts.length,
        },
      },
    });

    logger.info('PPTX generation job created', {
      userId: session.user.id,
      fileId: validatedData.fileId,
      jobId: job.id,
    });

    return {
      success: true,
      data: {
        jobId: job.id,
        status: 'pending',
        message: 'PPTX生成処理を開始しました',
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
        error: error.userMessage || 'PPTXの生成に失敗しました',
      };
    }

    logger.error('Failed to generate PPTX', error);
    return {
      success: false,
      error: 'PPTXの生成に失敗しました',
    };
  }
}

/**
 * テンプレートからPPTXを生成
 */
export async function generateFromTemplate(formData: FormData) {
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
      templateId: formData.get('templateId') as string,
      data: JSON.parse(formData.get('data') as string || '{}'),
      outputFormat: formData.get('outputFormat') as string || 'pptx',
    };

    // バリデーション
    const validatedData = generateFromTemplateSchema.parse(data);

    // テンプレートの存在確認
    // Templateモデルが存在しないため、Fileモデルを使用
    const template = await prisma.file.findUnique({
      where: { id: validatedData.templateId },
    });

    if (!template) {
      throw new AppError(
        'Template not found',
        ErrorCodes.FILE_NOT_FOUND,
        404,
        true,
        'テンプレートが見つかりません'
      );
    }

    // 一時ファイルパスを生成
    const tempDir = join(process.cwd(), 'tmp', 'generation');
    await mkdir(tempDir, { recursive: true });
    
    const outputFileName = `generated_${randomUUID()}.${validatedData.outputFormat}`;
    const outputPath = join(tempDir, outputFileName);

    // Pythonスクリプトを使用してテンプレートからPPTXを生成
    /* Templateモデル実装後に有効化
    const pythonScript = join(process.cwd(), 'python_backend', 'generate_from_template.py');
    // Templateモデルが必要なためコメントアウト
    // const command = `python3 "${pythonScript}" --template "${template.filePath}" --data '${JSON.stringify(validatedData.data)}' --output "${outputPath}" --format "${validatedData.outputFormat}"`;
    */
    
    // TODO: Templateに依存しない適切なコマンドに置き換える
    const command = 'echo "Template generation disabled"';
    
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) {
        logger.warn('Template generation warning', { stderr });
      }
      logger.info('Template generation output', { stdout });
    } catch (error) {
      logger.error('Template generation failed', error);
      throw new AppError(
        'Generation failed',
        ErrorCodes.UNKNOWN_ERROR,
        500,
        false,
        'テンプレートからの生成に失敗しました'
      );
    }

    // 生成されたファイルを読み込む
    const fileBuffer = await readFile(outputPath);
    
    // ファイルを保存
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'generated');
    await mkdir(uploadDir, { recursive: true });
    
    const finalFileName = `${session.user.id}_${outputFileName}`;
    const finalPath = join(uploadDir, finalFileName);
    await writeFile(finalPath, fileBuffer);

    // 一時ファイルを削除
    await unlink(outputPath);

    // データベースに記録
    const generatedFile = await prisma.file.create({
      data: {
        fileName: outputFileName,
        originalFileUrl: `/uploads/generated/${finalFileName}`,
        fileSize: fileBuffer.length,
        mimeType: validatedData.outputFormat === 'pptx' 
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : validatedData.outputFormat === 'pdf' 
          ? 'application/pdf'
          : 'application/zip',
        status: 'COMPLETED',
        userId: session.user.id,
        // metadataフィールドはFileモデルに存在しない
        // metadata: {
        //   templateId: validatedData.templateId,
        //   generatedAt: new Date().toISOString(),
        // },
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_UPLOAD',
        entityType: 'template',
        entityId: validatedData.templateId,
        metadata: {
          outputFormat: validatedData.outputFormat,
          fileId: generatedFile.id,
        },
      },
    });

    logger.info('Generated from template successfully', {
      userId: session.user.id,
      templateId: validatedData.templateId,
      fileId: generatedFile.id,
    });

    return {
      success: true,
      data: {
        fileId: generatedFile.id,
        fileName: outputFileName,
        fileUrl: `/uploads/generated/${finalFileName}`,
        fileSize: fileBuffer.length,
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
        error: error.userMessage || 'テンプレートからの生成に失敗しました',
      };
    }

    logger.error('Failed to generate from template', error);
    return {
      success: false,
      error: 'テンプレートからの生成に失敗しました',
    };
  }
}

/**
 * バッチPPTX生成
 */
export async function batchGenerate(data: z.infer<typeof batchGenerateSchema>) {
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
    const validatedData = batchGenerateSchema.parse(data);

    // Translationモデルを使用して各ジョブを作成
    const batchId = randomUUID();
    const jobs = await Promise.all(
      validatedData.jobs.map(async (job) => {
        return await prisma.translation.create({
          data: {
            fileId: job.fileId,
            status: 'pending',
            targetLanguage: 'PPTX_GENERATION',
            originalText: JSON.stringify({
              batchId,
              priority: validatedData.priority,
              translatedTexts: job.translatedTexts,
            }),
            progress: 0,
          },
        });
      })
    );

    // 非同期で各ジョブを処理
    jobs.forEach(job => {
      processGenerationJob(job.id).catch(error => {
        logger.error('Batch generation job failed', { jobId: job.id, error });
      });
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_UPLOAD',
        entityType: 'batch',
        entityId: 'batch',
        metadata: {
          jobCount: validatedData.jobs.length,
          priority: validatedData.priority,
          jobIds: jobs.map((j: any) => j.id),
        },
      },
    });

    logger.info('Batch generation jobs created', {
      userId: session.user.id,
      jobCount: jobs.length,
      priority: validatedData.priority,
    });

    return {
      success: true,
      data: {
        jobs: jobs.map((job: any) => ({
          id: job.id,
          fileId: job.fileId,
          status: job.status,
        })),
        totalCount: jobs.length,
        message: `${jobs.length}件の生成ジョブを開始しました`,
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
        error: error.userMessage || 'バッチ生成に失敗しました',
      };
    }

    logger.error('Failed to batch generate', error);
    return {
      success: false,
      error: 'バッチ生成に失敗しました',
    };
  }
}

/**
 * 生成ジョブのステータスを取得
 */
export async function getGenerationJobStatus(jobId: string) {
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
            userId: true,
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

    // 権限確認
    if (job.file.userId !== session.user.id) {
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
        outputFileUrl: job.translatedText, // translatedTextにURLを保存している
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        // error: job.error, // Translationモデルにerrorフィールドがない
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
 * 生成ジョブをキャンセル
 */
export async function cancelGenerationJob(jobId: string) {
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
            userId: true,
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

    // 権限確認
    if (job.file.userId !== session.user.id) {
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
          action: 'FILE_DELETE',
          entityType: 'generation_job',
          entityId: jobId,
        },
      });

      logger.info('Generation job cancelled', {
        userId: session.user.id,
        jobId,
      });

      return {
        success: true,
        message: '生成ジョブをキャンセルしました',
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
 * PPTXファイルを生成（簡易版 - EditorScreen用）
 */
export async function generatePptx(data: {
  originalFileUrl: string;
  editedSlides: Array<{
    pageNumber: number;
    texts: Array<{
      id: string;
      original: string;
      translated: string;
    }>;
  }>;
}) {
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

    // 一時ディレクトリを作成
    const tempId = randomUUID();
    const tempDir = join(process.cwd(), 'tmp', 'generation', tempId);
    await mkdir(tempDir, { recursive: true });

    // Pythonスクリプトを使用してPPTXを生成
    const pythonScript = join(process.cwd(), 'python_backend', 'generate_translated_pptx.py');
    const outputPath = join(tempDir, 'output.pptx');
    
    // 翻訳データをJSONファイルとして保存
    const translationDataPath = join(tempDir, 'translations.json');
    await writeFile(
      translationDataPath,
      JSON.stringify({
        slides: data.editedSlides,
      })
    );

    // uvが使える場合はuvを使い、なければpython3を使う
    let command: string;
    try {
      await execAsync('which uv');
      command = `uv run python "${pythonScript}" --input "${data.originalFileUrl}" --translations "${translationDataPath}" --output "${outputPath}"`;
    } catch {
      command = `python3 "${pythonScript}" --input "${data.originalFileUrl}" --translations "${translationDataPath}" --output "${outputPath}"`;
    }

    logger.info('Executing PPTX generation command', { command });

    try {
      const { stdout, stderr } = await execAsync(command, { 
        maxBuffer: 1024 * 1024 * 10,
        timeout: 60000 // 60秒のタイムアウト
      });
      
      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('PPTX generation warning', { stderr });
      }
      
      logger.info('PPTX generation output', { stdout });
    } catch (error) {
      logger.error('PPTX generation failed', error);
      throw new AppError(
        `PPTX generation failed: ${error}`,
        ErrorCodes.FILE_PROCESSING_FAILED,
        500,
        false,
        'PPTXファイルの生成に失敗しました'
      );
    }

    // 生成されたファイルを読み込む
    const fileBuffer = await readFile(outputPath);
    
    // Supabaseにアップロード
    const fileName = `translated_${Date.now()}.pptx`;
    let downloadUrl: string;
    
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const { error: uploadError } = await supabase.storage
          .from('generated-pptx')
          .upload(fileName, fileBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            upsert: true
          });
        
        if (uploadError) {
          throw uploadError;
        }
        
        const { data: urlData } = supabase.storage
          .from('generated-pptx')
          .getPublicUrl(fileName);
        
        downloadUrl = urlData.publicUrl;
      } catch (error) {
        logger.error('Supabase upload error', error);
        // フォールバック: ローカルに保存
        const publicDir = join(process.cwd(), 'public', 'downloads');
        await mkdir(publicDir, { recursive: true });
        const publicPath = join(publicDir, fileName);
        await writeFile(publicPath, fileBuffer);
        downloadUrl = `/downloads/${fileName}`;
      }
    } else {
      // ローカルに保存
      const publicDir = join(process.cwd(), 'public', 'downloads');
      await mkdir(publicDir, { recursive: true });
      const publicPath = join(publicDir, fileName);
      await writeFile(publicPath, fileBuffer);
      downloadUrl = `/downloads/${fileName}`;
    }

    // 一時ファイルを削除
    try {
      await unlink(outputPath);
      await unlink(translationDataPath);
    } catch (e) {
      logger.warn('Failed to clean up temp files', { error: e });
    }

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_UPLOAD',
        entityType: 'pptx_generation',
        entityId: tempId,
        metadata: {
          slideCount: data.editedSlides.length,
          textCount: data.editedSlides.reduce(
            (sum, slide) => sum + slide.texts.length,
            0
          ),
        },
      },
    });

    logger.info('PPTX generated successfully', {
      userId: session.user.id,
      fileName,
      downloadUrl,
    });

    return {
      success: true,
      downloadUrl,
      fileName,
    };
  } catch (error) {
    if (error instanceof AppError) {
      logger.logAppError(error);
      return {
        success: false,
        error: error.userMessage || 'PPTXの生成に失敗しました',
      };
    }

    logger.error('Failed to generate PPTX', error);
    return {
      success: false,
      error: 'PPTXの生成に失敗しました',
    };
  }
}

/**
 * 生成ジョブを処理（内部関数）
 */
async function processGenerationJob(jobId: string) {
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

    // 一時ディレクトリを作成
    const tempDir = join(process.cwd(), 'tmp', 'generation', jobId);
    await mkdir(tempDir, { recursive: true });

    // Pythonスクリプトを使用してPPTXを生成
    const pythonScript = join(process.cwd(), 'python_backend', 'generate_pptx.py');
    const outputPath = join(tempDir, 'output.pptx');
    
    const metadata = JSON.parse(job.originalText || '{}');
    // uvが使える場合はuvを使い、なければpython3を使う
    let command: string;
    try {
      await execAsync('which uv');
      command = `uv run python "${pythonScript}" --input "${job.file.originalFileUrl}" --output "${outputPath}" --texts '${JSON.stringify(metadata.translatedTexts)}' --options '${JSON.stringify(metadata.options || {})}'`;
    } catch {
      command = `python3 "${pythonScript}" --input "${job.file.originalFileUrl}" --output "${outputPath}" --texts '${JSON.stringify(metadata.translatedTexts)}' --options '${JSON.stringify(metadata.options || {})}'`;
    }

    // 進捗を更新
    await prisma.translation.update({
      where: { id: jobId },
      data: { progress: 30 },
    });

    try {
      const { stdout, stderr } = await execAsync(command, { maxBuffer: 1024 * 1024 * 10 });
      if (stderr) {
        logger.warn('PPTX generation warning', { stderr });
      }
      logger.info('PPTX generation output', { stdout });
    } catch (error) {
      throw new Error(`PPTX generation failed: ${error}`);
    }

    // 進捗を更新
    await prisma.translation.update({
      where: { id: jobId },
      data: { progress: 70 },
    });

    // 生成されたファイルを保存
    const fileBuffer = await readFile(outputPath);
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'generated');
    await mkdir(uploadDir, { recursive: true });
    
    const fileName = `${job.file.userId}_${jobId}.pptx`;
    const finalPath = join(uploadDir, fileName);
    await writeFile(finalPath, fileBuffer);

    // 一時ファイルを削除
    await unlink(outputPath);

    // ジョブを完了に更新
    await prisma.translation.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        translatedText: `/uploads/generated/${fileName}`, // URLを保存
        completedAt: new Date(),
      },
    });

    // 新しいファイルレコードを作成
    await prisma.file.create({
      data: {
        fileName: `translated_${job.file.fileName}`,
        originalFileUrl: `/uploads/generated/${fileName}`,
        fileSize: fileBuffer.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'COMPLETED',
        userId: job.file.userId,
      },
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/files');

    logger.info('Generation job completed', { jobId });
  } catch (error) {
    logger.error('Generation job failed', { jobId, error });

    await prisma.translation.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        translatedText: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}
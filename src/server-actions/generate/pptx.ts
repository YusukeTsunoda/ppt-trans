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
  data: z.record(z.any()),
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
 * PPTXファイルを生成
 */
export async function generatePptx(formData: FormData) {
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
        ErrorCodes.NOT_FOUND,
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

    // 生成ジョブを作成
    const job = await prisma.generationJob.create({
      data: {
        fileId: validatedData.fileId,
        userId: session.user.id,
        type: 'pptx',
        status: 'pending',
        metadata: {
          translatedTexts: validatedData.translatedTexts,
          options: validatedData.options,
        },
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
        action: 'GENERATE',
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
        error: error.errors[0].message,
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
    const template = await prisma.template.findUnique({
      where: { id: validatedData.templateId },
    });

    if (!template) {
      throw new AppError(
        'Template not found',
        ErrorCodes.NOT_FOUND,
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
    const pythonScript = join(process.cwd(), 'python_backend', 'generate_from_template.py');
    const command = `python3 "${pythonScript}" --template "${template.filePath}" --data '${JSON.stringify(validatedData.data)}' --output "${outputPath}" --format "${validatedData.outputFormat}"`;

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
        ErrorCodes.PROCESSING_ERROR,
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
        filePath: `/uploads/generated/${finalFileName}`,
        fileSize: fileBuffer.length,
        mimeType: validatedData.outputFormat === 'pptx' 
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : validatedData.outputFormat === 'pdf' 
          ? 'application/pdf'
          : 'application/zip',
        status: 'COMPLETED',
        userId: session.user.id,
        metadata: {
          templateId: validatedData.templateId,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // 監査ログを記録
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'GENERATE',
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
        error: error.errors[0].message,
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

    // 各ジョブを作成
    const jobs = await Promise.all(
      validatedData.jobs.map(async (job) => {
        return await prisma.generationJob.create({
          data: {
            fileId: job.fileId,
            userId: session.user.id,
            type: 'pptx',
            status: 'pending',
            priority: validatedData.priority,
            metadata: {
              batchId: randomUUID(),
              translatedTexts: job.translatedTexts,
            },
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
        action: 'GENERATE',
        entityType: 'batch',
        entityId: 'batch',
        metadata: {
          jobCount: validatedData.jobs.length,
          priority: validatedData.priority,
          jobIds: jobs.map(j => j.id),
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
        jobs: jobs.map(job => ({
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
        error: error.errors[0].message,
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

    const job = await prisma.generationJob.findUnique({
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
        outputFileUrl: job.outputFileUrl,
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

    const job = await prisma.generationJob.findUnique({
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
        ErrorCodes.AUTH_UNAUTHORIZED,
        403,
        true,
        'このジョブへのアクセス権限がありません'
      );
    }

    // ジョブをキャンセル
    if (job.status === 'pending' || job.status === 'processing') {
      await prisma.generationJob.update({
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
 * 生成ジョブを処理（内部関数）
 */
async function processGenerationJob(jobId: string) {
  try {
    // ジョブを取得
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: {
        file: true,
      },
    });

    if (!job) {
      throw new Error('Job not found');
    }

    // ステータスを処理中に更新
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    // 一時ディレクトリを作成
    const tempDir = join(process.cwd(), 'tmp', 'generation', jobId);
    await mkdir(tempDir, { recursive: true });

    // Pythonスクリプトを使用してPPTXを生成
    const pythonScript = join(process.cwd(), 'python_backend', 'generate_pptx.py');
    const outputPath = join(tempDir, 'output.pptx');
    
    const metadata = job.metadata as any;
    const command = `python3 "${pythonScript}" --input "${job.file.filePath}" --output "${outputPath}" --texts '${JSON.stringify(metadata.translatedTexts)}' --options '${JSON.stringify(metadata.options || {})}'`;

    // 進捗を更新
    await prisma.generationJob.update({
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
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 70 },
    });

    // 生成されたファイルを保存
    const fileBuffer = await readFile(outputPath);
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'generated');
    await mkdir(uploadDir, { recursive: true });
    
    const fileName = `${job.userId}_${jobId}.pptx`;
    const finalPath = join(uploadDir, fileName);
    await writeFile(finalPath, fileBuffer);

    // 一時ファイルを削除
    await unlink(outputPath);

    // ジョブを完了に更新
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        progress: 100,
        outputFileUrl: `/uploads/generated/${fileName}`,
        completedAt: new Date(),
      },
    });

    // 新しいファイルレコードを作成
    await prisma.file.create({
      data: {
        fileName: `translated_${job.file.fileName}`,
        filePath: `/uploads/generated/${fileName}`,
        fileSize: fileBuffer.length,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'COMPLETED',
        userId: job.userId,
        parentId: job.fileId,
        metadata: {
          generationJobId: jobId,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    // キャッシュを再検証
    revalidatePath('/dashboard/files');

    logger.info('Generation job completed', { jobId });
  } catch (error) {
    logger.error('Generation job failed', { jobId, error });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
  }
}
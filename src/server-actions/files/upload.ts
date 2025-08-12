'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { AppError } from '@/lib/errors/AppError';
import { ErrorCodes } from '@/lib/errors/ErrorCodes';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { supabase } from '@/lib/supabaseClient';
import { validateUploadedFile } from '@/lib/security/fileValidator';
import { fileUploadSchema, validateInput } from '@/lib/validation/schemas';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawn } from 'child_process';
import type { SlideData } from '@/types';
import { setUploadProgressAction, updateUploadStepAction } from './upload-progress';
import { withRetry } from '@/lib/utils/retry';
import { TimeoutConfig, adjustTimeoutForFileSize } from '@/lib/config/timeout';

export interface UploadState {
  success: boolean;
  error?: string;
  fileId?: string;
  fileName?: string;
  slides?: SlideData[];
  totalSlides?: number;
  progress?: number;
  message?: string;
}

/**
 * PPTXファイルをアップロードして処理するServer Action
 * 自動的にCSRF保護が適用される
 */
export async function uploadPptxAction(
  prevState: UploadState | null,
  formData: FormData
): Promise<UploadState> {
  const startTime = Date.now();
  let tempDir: string | null = null;
  let tempPptxPath: string | null = null;
  const uploadId = uuidv4();
  
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // ファイル取得
    const file = formData.get('file') as File;
    
    if (!file) {
      return {
        success: false,
        error: 'ファイルが選択されていません'
      };
    }
    
    // 進捗追跡を初期化
    await setUploadProgressAction(uploadId, {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      uploadedBytes: 0,
      progress: 0,
      status: 'uploading',
      message: 'アップロードを開始しています...',
      startedAt: new Date().toISOString(),
      steps: [
        { name: 'ファイル検証', status: 'pending' },
        { name: 'セキュリティチェック', status: 'pending' },
        { name: 'ファイル保存', status: 'pending' },
        { name: 'PPTX処理', status: 'pending' },
        { name: 'データベース記録', status: 'pending' }
      ]
    });
    
    // ファイルバリデーション（Zodスキーマ）
    await updateUploadStepAction(uploadId, 'ファイル検証', 'in_progress');
    const validationResult = validateInput(fileUploadSchema, {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    
    if (!validationResult.success) {
      logger.warn('File validation failed', { 
        userId: session.user.id,
        fileName: file.name,
        errors: validationResult.errors.issues 
      });
      
      await updateUploadStepAction(uploadId, 'ファイル検証', 'failed');
      return {
        success: false,
        error: 'ファイルの検証に失敗しました'
      };
    }
    
    await updateUploadStepAction(uploadId, 'ファイル検証', 'completed');
    
    // セキュリティ検証（ファイル内容）
    await updateUploadStepAction(uploadId, 'セキュリティチェック', 'in_progress');
    const securityValidation = await validateUploadedFile(file, 'pptx', file.name);
    
    if (!securityValidation.valid) {
      logger.warn('File security validation failed', { 
        userId: session.user.id,
        fileName: file.name,
        error: securityValidation.error
      });
      
      await updateUploadStepAction(uploadId, 'セキュリティチェック', 'failed');
      return {
        success: false,
        error: securityValidation.error || 'ファイルのセキュリティ検証に失敗しました'
      };
    }
    
    // 使用量制限チェック
    const usageLimit = await prisma.usageLimit.findUnique({
      where: { userId: session.user.id }
    });
    
    if (usageLimit) {
      // 月間ファイル数制限チェック
      const currentMonth = new Date().getMonth();
      const limitMonth = usageLimit.resetDate.getMonth();
      
      if (currentMonth !== limitMonth) {
        // 月が変わったらリセット
        await prisma.usageLimit.update({
          where: { userId: session.user.id },
          data: {
            currentMonthFiles: 0,
            resetDate: new Date(new Date().setDate(1))
          }
        });
      } else if (usageLimit.currentMonthFiles >= usageLimit.monthlyFileLimit) {
        return {
          success: false,
          error: `月間アップロード制限（${usageLimit.monthlyFileLimit}ファイル）に達しました`
        };
      }
      
      // ファイルサイズ制限チェック
      if (file.size > usageLimit.maxFileSize) {
        return {
          success: false,
          error: `ファイルサイズが制限（${Math.round(usageLimit.maxFileSize / 1024 / 1024)}MB）を超えています`
        };
      }
    }
    
    await updateUploadStepAction(uploadId, 'セキュリティチェック', 'completed');
    
    // 一時ディレクトリ作成
    await updateUploadStepAction(uploadId, 'ファイル保存', 'in_progress');
    const tempId = uuidv4();
    tempDir = join(process.cwd(), 'tmp', tempId);
    await mkdir(tempDir, { recursive: true });
    
    // ファイルを一時保存
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    tempPptxPath = join(tempDir, 'input.pptx');
    await writeFile(tempPptxPath, fileBuffer);
    
    // 進捗更新
    await setUploadProgressAction(uploadId, {
      uploadedBytes: fileBuffer.length,
      message: 'ファイルをサーバーに保存中...'
    });
    
    // Supabaseへアップロード
    const originalFileName = `uploads/${session.user.id}/${tempId}.pptx`;
    let originalFileUrl = '';
    
    // Supabase設定確認
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        // バケット確認・作成
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(bucket => bucket.name === 'pptx-files');
        
        if (!bucketExists) {
          await supabase.storage.createBucket('pptx-files', {
            public: true,
            fileSizeLimit: 52428800, // 50MB
          });
        }
        
        // ファイルアップロード（リトライ機能付き）
        const { error: uploadError } = await withRetry(
          async () => supabase.storage
            .from('pptx-files')
            .upload(originalFileName, fileBuffer, {
              contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              upsert: true
            }),
          {
            maxRetries: 3,
            delay: 2000,
            onRetry: (attempt, error) => {
              logger.warn('Supabase upload retry', {
                attempt,
                error: error.message,
                fileName: file.name,
                fileSize: fileBuffer.length
              });
            }
          }
        );
        
        if (uploadError) {
          logger.error('Supabase upload error after retries', uploadError);
          originalFileUrl = `/tmp/${tempId}/input.pptx`; // フォールバック
        } else {
          const { data } = supabase.storage
            .from('pptx-files')
            .getPublicUrl(originalFileName);
          originalFileUrl = data.publicUrl;
        }
      } catch (error) {
        logger.error('Supabase error', error);
        originalFileUrl = `/tmp/${tempId}/input.pptx`; // フォールバック
      }
    } else {
      // ローカルファイルシステムを使用
      originalFileUrl = `/tmp/${tempId}/input.pptx`;
    }
    
    await updateUploadStepAction(uploadId, 'ファイル保存', 'completed');
    
    // Pythonスクリプトで処理（タイムアウト付き）
    await updateUploadStepAction(uploadId, 'PPTX処理', 'in_progress');
    await setUploadProgressAction(uploadId, {
      status: 'processing',
      message: 'PPTXファイルを処理中...'
    });
    
    // ファイルサイズに応じてタイムアウトを調整
    const processingTimeout = adjustTimeoutForFileSize(
      TimeoutConfig.processing.imageConversion,
      fileBuffer.length
    );
    
    const processingResult = await processPptxWithPython(
      tempPptxPath,
      tempDir,
      tempId,
      processingTimeout
    );
    
    await updateUploadStepAction(uploadId, 'PPTX処理', 'completed');
    
    // データベースに保存
    await updateUploadStepAction(uploadId, 'データベース記録', 'in_progress');
    
    // ユーザーが存在するか確認
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!existingUser) {
      logger.error('User not found in database', { 
        sessionUserId: session.user.id,
        sessionEmail: session.user.email 
      });
      
      // セッションのemailでユーザーを検索
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email || '' }
      });
      
      if (!userByEmail) {
        throw new Error('ユーザーが見つかりません。再度ログインしてください。');
      }
      
      // emailで見つかったユーザーのIDを使用
      session.user.id = userByEmail.id;
    }
    
    const fileRecord = await prisma.file.create({
      data: {
        userId: session.user.id,
        fileName: file.name,
        originalFileUrl,
        fileSize: fileBuffer.length,
        mimeType: file.type,
        status: 'COMPLETED',
        processedAt: new Date(),
        totalSlides: processingResult.slides.length,
      }
    });
    
    // 使用量更新
    if (usageLimit) {
      await prisma.usageLimit.update({
        where: { userId: session.user.id },
        data: {
          currentMonthFiles: { increment: 1 }
        }
      });
    }
    
    // アクティビティログ
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: 'FILE_UPLOAD',
        targetType: 'file',
        targetId: fileRecord.id,
        metadata: {
          fileName: file.name,
          fileSize: fileBuffer.length,
          slideCount: processingResult.slides.length
        }
      }
    });
    
    logger.info('File uploaded successfully', { 
      userId: session.user.id,
      fileId: fileRecord.id,
      fileName: file.name,
      duration: Date.now() - startTime
    });
    
    await updateUploadStepAction(uploadId, 'データベース記録', 'completed');
    
    // 進捗を完了に更新
    await setUploadProgressAction(uploadId, {
      status: 'completed',
      progress: 100,
      message: 'アップロードが完了しました'
    });
    
    // キャッシュを再検証
    revalidatePath('/files');
    revalidatePath('/');
    
    return {
      success: true,
      fileId: fileRecord.id,
      fileName: file.name,
      slides: processingResult.slides.map(slide => ({
        ...slide,
        originalFileUrl
      })),
      totalSlides: processingResult.slides.length,
      message: 'ファイルのアップロードが完了しました'
    };
    
  } catch (error) {
    logger.error('File upload error', error);
    
    const appError = new AppError(
      error instanceof Error ? error.message : 'Unknown error',
      ErrorCodes.FILE_UPLOAD_FAILED,
      500,
      false,
      'ファイルアップロード中にエラーが発生しました'
    );
    
    logger.logAppError(appError, { 
      userId: (await getServerSession(authOptions))?.user?.id,
      duration: Date.now() - startTime 
    });
    
    return {
      success: false,
      error: appError.userMessage || 'アップロードに失敗しました'
    };
    
  } finally {
    // 一時ファイルのクリーンアップ
    if (tempPptxPath) {
      try {
        await unlink(tempPptxPath);
      } catch (e) {
        logger.warn('Failed to clean up temporary file', e as Record<string, unknown>);
      }
    }
  }
}

/**
 * Pythonスクリプトでファイルを処理
 */
async function processPptxWithPython(
  pptxPath: string,
  tempDir: string,
  tempId: string,
  timeoutMs: number = 60000
): Promise<{ slides: SlideData[] }> {
  return new Promise((resolve, reject) => {
    const pythonScriptPath = join(process.cwd(), 'scripts', 'process_pptx.py');
    
    // pythonコマンドを決定（uvが利用可能ならuv run python、なければpython3）
    let pythonCommand = 'python3';
    let pythonArgs = [pythonScriptPath, pptxPath, tempDir, tempId];
    
    // uvコマンドが利用可能か確認
    try {
      const { execSync } = require('child_process'); // eslint-disable-line @typescript-eslint/no-require-imports
      execSync('which uv', { stdio: 'ignore' });
      pythonCommand = 'uv';
      pythonArgs = ['run', 'python', ...pythonArgs];
    } catch {
      // uvが利用できない場合はpython3を使用
      logger.info('uv not found, using python3 directly');
    }
    
    const pythonProcess = spawn(pythonCommand, pythonArgs, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    });
    
    let stdout = '';
    let stderr = '';
    let processKilled = false;
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      // 進捗情報をログ出力
      if (stderr.includes('Processing slide')) {
        logger.info('Python processing progress', { message: stderr });
      }
    });
    
    pythonProcess.on('close', (code) => {
      if (processKilled) {
        return; // タイムアウトで既に処理済み
      }
      
      if (code !== 0) {
        logger.error('Python process failed', {
          code,
          stderr,
          stdout,
          scriptPath: pythonScriptPath
        });
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${parseError}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      if (!processKilled) {
        logger.error('Python process error', { 
          error: error.message,
          scriptPath: pythonScriptPath,
          cwd: process.cwd()
        });
        reject(new Error(`Failed to start Python process: ${error.message}`));
      }
    });
    
    // タイムアウト設定（動的）
    const timeoutId = setTimeout(() => {
      processKilled = true;
      pythonProcess.kill('SIGTERM');
      
      // 強制終了が必要な場合
      setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGKILL');
        }
      }, 5000);
      
      reject(new Error(`Python processing timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // プロセスが正常終了したらタイムアウトをクリア
    pythonProcess.on('exit', () => {
      clearTimeout(timeoutId);
    });
  });
}

/**
 * アップロード進捗を取得するServer Action
 * ※ Server Actionsではストリーミングが制限されるため、
 * ポーリングベースの実装
 */
export async function getUploadProgressAction(
  _uploadId: string
): Promise<{
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  message?: string;
}> {
  // TODO: Redisなどを使用して進捗を追跡
  // 現在は簡易実装
  return {
    progress: 100,
    status: 'completed',
    message: '処理完了'
  };
}
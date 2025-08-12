'use server';

import logger from '@/lib/logger';
import { ServerActionState } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
// FileUploadManagerは将来的に大容量ファイルのチャンクアップロードに使用可能
// import { FileUploadManager } from '@/lib/upload/FileUploadManager';
import { GenerationStatusManager } from '@/lib/generation/GenerationStatusManager';
import { logActivity } from '@/lib/activity-logger';
import { getServerSession } from 'next-auth';

const execAsync = promisify(exec);

export interface UploadResult {
  fileId: string;  // 追加: ファイルの一意識別子
  fileName: string;
  slides: Array<{
    pageNumber: number;
    imageUrl: string;
    originalFileUrl: string;
    texts: Array<{
      id: string;
      original: string;
      translated: string | null;
      position: { x: number; y: number };
    }>;
  }>;
  totalSlides: number;
}

/**
 * PPTXファイルアップロード Server Action
 * useActionStateと互換性のある形式
 */
export async function uploadPptxAction(
  _prevState: ServerActionState<UploadResult>,
  formData: FormData
): Promise<ServerActionState<UploadResult>> {
  console.log('=== uploadPptxAction STARTED ===');
  console.log('FormData keys:', Array.from(formData.keys()));
  console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => 
    [key, value instanceof File ? `File: ${value.name}` : value]
  ));
  
  const statusManager = GenerationStatusManager.getInstance();
  let jobId: string | undefined;
  
  try {
    console.log('Getting file from FormData...');
    // FormDataからファイルを取得
    const file = formData.get('file') as File;
    console.log('File info:', file ? { name: file.name, size: file.size, type: file.type } : 'No file');
    
    if (!file) {
      console.log('No file found, returning error');
      const result = {
        success: false,
        message: 'ファイルが選択されていません',
      };
      console.log('Returning:', result);
      return result;
    }

    // ファイルタイプの検証
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ];
    
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        message: 'PPTXファイルのみアップロード可能です',
        
      };
    }

    // ファイルサイズの検証（100MB制限）
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return {
        success: false,
        message: 'ファイルサイズは100MB以下にしてください',
        
      };
    }

    // アップロードディレクトリとファイルの準備
    const tempId = uuidv4();
    const uploadBaseDir = path.join(process.cwd(), 'uploads');
    const tempDir = path.join(uploadBaseDir, `pptx_${tempId}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // ジョブを作成
    const job = statusManager.createJob(tempId, file.name, {
      fileSize: file.size,
      mimeType: file.type,
    });
    jobId = job.id;
    statusManager.updateProgress(jobId, 10, 'ファイルを受信しました');
    
    // ファイルを一時的に保存（将来的にはFileUploadManagerでチャンク分割アップロードも可能）
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempFilePath = path.join(tempDir, file.name);
    await fs.writeFile(tempFilePath, buffer);
    
    // ジョブステータスを更新
    if (jobId) {
      statusManager.updateProgress(jobId, 20, 'PPTXファイルを処理中...');
    }
    
    // Python処理スクリプトを呼び出し
    const scriptPath = path.join(process.cwd(), 'scripts', 'process_pptx.py');
    
    try {
      // Supabase環境変数が設定されているか確認
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        logger.warn('Supabase credentials not configured, using mock data');
        // Supabaseが設定されていない場合はモックデータを返す
        const mockSlides = Array.from({ length: 5 }, (_, i) => ({
          pageNumber: i + 1,
          imageUrl: `/api/placeholder/${400}/${300}`,
          originalFileUrl: tempFilePath, // uploadsディレクトリのパス
          texts: [
            {
              id: `text-${i}-1`,
              original: `サンプルテキスト ${i + 1}-1`,
              translated: null,
              position: { x: 100, y: 100 },
            },
            {
              id: `text-${i}-2`,
              original: `サンプルテキスト ${i + 1}-2`,
              translated: null,
              position: { x: 100, y: 200 },
            },
          ],
        }));
        
        const mockResult = {
          success: true,
          data: {
            fileId: tempId,  // 追加: ファイルID
            fileName: file.name,
            slides: mockSlides,
            totalSlides: mockSlides.length,
          },
          message: 'ファイルがアップロードされました（モックモード）',
          
        };
        console.log('=== uploadPptxAction MOCK SUCCESS ===');
        console.log('Returning mock result:', mockResult);
        return mockResult;
      }
      
      // ジョブステータスを更新
      if (jobId) {
        statusManager.updateProgress(jobId, 50, 'Pythonスクリプトを実行中...');
      }
      
      // Pythonスクリプトを実行（仮想環境または システムPythonを使用）
      const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
      const pythonCmd = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');
      
      const { stdout, stderr } = await execAsync(
        `SUPABASE_URL="${supabaseUrl}" SUPABASE_KEY="${supabaseKey}" ${pythonCmd} "${scriptPath}" "${tempFilePath}" "${tempDir}" "${tempId}"`,
        {
          maxBuffer: 1024 * 1024 * 10, // 10MB
          timeout: 60 * 1000, // 60秒
        }
      );
      
      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('Python script stderr:', { stderr });
      }
      
      // 結果をパース
      const result = JSON.parse(stdout);
      
      // 一時ファイルをクリーンアップしない（ダウンロード時に必要）
      // await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      
      // APIレスポンス形式に変換
      const processedSlides = result.slides.map((slide: any) => ({
        pageNumber: slide.pageNumber,
        imageUrl: slide.imageUrl,
        originalFileUrl: tempFilePath, // uploadsディレクトリのパス
        texts: slide.texts.map((text: any) => ({
          id: text.id,
          original: text.original,
          translated: text.translated || null,
          position: text.position,
        })),
      }));

      // ジョブを完了
      if (jobId) {
        statusManager.completeJob(jobId, tempFilePath);
      }
      
      logger.info('File uploaded and processed', {
        fileName: file.name,
        fileSize: file.size,
        slideCount: processedSlides.length,
        jobId,
      });

      // アクティビティログを記録
      try {
        const session = await getServerSession();
        if (session?.user?.id) {
          await logActivity({
            userId: session.user.id,
            action: 'FILE_UPLOAD',
            targetType: 'file',
            targetId: tempId,
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              slideCount: processedSlides.length,
            },
          });
        }
      } catch (logError) {
        logger.error('Failed to log activity', logError);
      }

      const successResult = {
        success: true,
        data: {
          fileId: tempId,  // 追加: ファイルID
          fileName: file.name,
          slides: processedSlides,
          totalSlides: result.totalSlides || processedSlides.length,
        },
        message: 'ファイルがアップロードされ、処理されました',
        
      };
      console.log('=== uploadPptxAction SUCCESS ===');
      console.log('Returning success result:', successResult);
      return successResult;
    } catch (pythonError) {
      // Pythonスクリプトのエラー処理
      logger.error('Python script execution failed', pythonError);
      
      // エラー時もファイルを保持（デバッグ用）
      // await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      
      return {
        success: false,
        message: 'ファイルの処理中にエラーが発生しました。PPTXファイルが破損している可能性があります。',
        
      };
    }
  } catch (error) {
    console.error('=== uploadPptxAction ERROR ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // ジョブを失敗としてマーク
    if (jobId) {
      statusManager.failJob(jobId, error instanceof Error ? error.message : '不明なエラー');
    }
    
    logger.error('Upload file error', error);
    return {
      success: false,
      message: 'ファイルのアップロード中にエラーが発生しました',
      
    };
  }
}
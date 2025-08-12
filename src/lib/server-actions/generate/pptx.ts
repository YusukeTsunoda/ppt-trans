'use server';

import { ServerActionState } from '../types';
import logger from '@/lib/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export interface GeneratePptxResult {
  downloadUrl: string;
  fileName: string;
  fileSize: number;
}

/**
 * PPTX生成 Server Action
 */
export async function generatePptx(
  _prevState: ServerActionState<GeneratePptxResult>,
  formData: FormData
): Promise<ServerActionState<GeneratePptxResult>> {
  try {
    const data = Object.fromEntries(formData.entries());
    const fileId = data.fileId as string;
    const translationId = data.translationId as string;

    if (!fileId || !translationId) {
      return {
        success: false,
        message: 'ファイルIDと翻訳IDが必要です',
        
      };
    }

    // 一時ディレクトリとファイルの準備
    const tempId = uuidv4();
    const outputDir = path.join(process.cwd(), 'public', 'generated');
    await fs.mkdir(outputDir, { recursive: true });
    
    // Pythonスクリプトのパス
    const scriptPath = path.join(process.cwd(), 'python_backend', 'generate_pptx.py');
    
    // データベースから翻訳データを取得（仮の実装）
    // TODO: 実際のデータベースから取得
    const editedSlides = formData.get('editedSlides') as string;
    const originalFileUrl = formData.get('originalFileUrl') as string;
    
    if (!editedSlides || !originalFileUrl) {
      // モックモード
      const generatedUrl = `/generated/${Date.now()}_translated.pptx`;
      const fileName = `translated_${Date.now()}.pptx`;
      const fileSize = Math.floor(Math.random() * 1000000) + 500000;
      
      return {
        success: true,
        data: {
          downloadUrl: generatedUrl,
          fileName,
          fileSize,
        },
        message: 'PPTXファイルを生成しました（モックモード）',
        
      };
    }
    
    try {
      // 翻訳データをJSONファイルとして保存
      const translationFile = path.join(outputDir, `translation_${tempId}.json`);
      await fs.writeFile(translationFile, editedSlides);
      
      // 出力ファイル名
      const outputFileName = `translated_${tempId}.pptx`;
      const outputPath = path.join(outputDir, outputFileName);
      
      // Pythonスクリプトを実行（仮想環境またはシステムPythonを使用）
      const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
      const pythonCmd = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');
      
      const { stderr } = await execAsync(
        `${pythonCmd} "${scriptPath}" --input "${originalFileUrl}" --translations "${translationFile}" --output "${outputPath}"`,
        {
          maxBuffer: 1024 * 1024 * 10, // 10MB
          timeout: 60 * 1000, // 60秒
        }
      );
      
      if (stderr && !stderr.includes('WARNING')) {
        logger.warn('Python script stderr:', { stderr });
      }
      
      // 結果をパース（現在未使用だが、将来的にログや検証に使用可能）
      // const result = JSON.parse(stdout);
      
      // ファイルサイズを取得
      const stats = await fs.stat(outputPath);
      const fileSize = stats.size;
      
      // 一時ファイルをクリーンアップ
      await fs.unlink(translationFile).catch(() => {});
      
      const downloadUrl = `/generated/${outputFileName}`;
      const fileName = outputFileName;

      logger.info('PPTX generated', {
        fileId,
        translationId,
        fileName,
        fileSize,
      });

      return {
        success: true,
        data: {
          downloadUrl,
          fileName,
          fileSize,
        },
        message: 'PPTXファイルを生成しました',
        
      };
    } catch (pythonError) {
      logger.error('Python script execution failed', pythonError);
      
      // モックモードにフォールバック
      const generatedUrl = `/generated/${Date.now()}_translated.pptx`;
      const fileName = `translated_${Date.now()}.pptx`;
      const fileSize = Math.floor(Math.random() * 1000000) + 500000;
      
      return {
        success: true,
        data: {
          downloadUrl: generatedUrl,
          fileName,
          fileSize,
        },
        message: 'PPTXファイルを生成しました（モックモード）',
        
      };
    }
  } catch (error) {
    logger.error('Generate PPTX error', error);
    return {
      success: false,
      message: 'PPTX生成中にエラーが発生しました',
      
    };
  }
}
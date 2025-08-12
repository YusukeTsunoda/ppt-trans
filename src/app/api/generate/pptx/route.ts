import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';

const execAsync = promisify(exec);

interface TranslatedText {
  id: string;
  original: string;
  translated: string;
}

interface EditedSlide {
  pageNumber: number;
  texts: TranslatedText[];
}

interface GenerateRequest {
  originalFileUrl: string;
  editedSlides: EditedSlide[];
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    const body: GenerateRequest = await request.json();
    const { originalFileUrl, editedSlides } = body;

    // 入力検証
    if (!originalFileUrl || !editedSlides || !Array.isArray(editedSlides)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request data' 
        },
        { status: 400 }
      );
    }

    logger.info('Starting PPTX generation', {
      originalFileUrl,
      slideCount: editedSlides.length
    });

    // 一時ディレクトリを作成
    const tempId = uuidv4();
    tempDir = `/tmp/pptx_gen_${tempId}`;
    await fs.mkdir(tempDir, { recursive: true });

    // 翻訳データをJSON形式で保存
    const translationData = {
      slides: editedSlides.map(slide => ({
        pageNumber: slide.pageNumber,
        texts: slide.texts.map(text => ({
          id: text.id,
          original: text.original,
          translated: text.translated || text.original
        }))
      }))
    };

    const translationFile = path.join(tempDir, 'translations.json');
    await fs.writeFile(translationFile, JSON.stringify(translationData, null, 2));

    // 元のPPTXファイルをダウンロード（Supabaseまたはローカル）
    let originalFilePath: string;
    
    if (originalFileUrl.startsWith('http')) {
      // URLからダウンロード
      originalFilePath = path.join(tempDir, 'original.pptx');
      const response = await fetch(originalFileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download original file: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      await fs.writeFile(originalFilePath, Buffer.from(buffer));
    } else {
      // ローカルファイルのパス
      // uploadsディレクトリを考慮
      if (!originalFileUrl.startsWith('/')) {
        // 相対パスの場合はcwdからの相対パス
        originalFilePath = path.join(process.cwd(), originalFileUrl);
      } else if (originalFileUrl.startsWith('/tmp/')) {
        // /tmp/で始まる場合はuploadsディレクトリに変換
        const fileName = path.basename(originalFileUrl);
        const dirName = path.basename(path.dirname(originalFileUrl));
        originalFilePath = path.join(process.cwd(), 'uploads', dirName, fileName);
      } else {
        originalFilePath = originalFileUrl;
      }
      
      // ファイルの存在確認
      try {
        await fs.access(originalFilePath);
        logger.info('Original file found at:', { originalFilePath });
      } catch {
        // ファイルが見つからない場合、元のパスも試す
        try {
          await fs.access(originalFileUrl);
          originalFilePath = originalFileUrl;
          logger.info('Original file found at fallback:', { originalFilePath });
        } catch {
          throw new Error(`Original file not found: ${originalFilePath} (also tried: ${originalFileUrl})`);
        }
      }
    }

    // 出力ファイルパス
    const outputFilePath = path.join(tempDir, 'translated.pptx');

    // Pythonスクリプトを実行
    const scriptPath = path.join(process.cwd(), 'python_backend', 'generate_pptx.py');
    
    // 仮想環境またはシステムPythonを使用
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    const pythonCmd = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');

    logger.info('Executing Python script', {
      scriptPath,
      pythonCmd,
      originalFilePath,
      translationFile,
      outputFilePath
    });

    const { stdout, stderr } = await execAsync(
      `${pythonCmd} "${scriptPath}" --input "${originalFilePath}" --translations "${translationFile}" --output "${outputFilePath}"`,
      {
        maxBuffer: 1024 * 1024 * 10, // 10MB
        timeout: 120 * 1000, // 120秒
      }
    );

    if (stderr && !stderr.includes('WARNING')) {
      logger.warn('Python script stderr:', { stderr });
    }

    // 生成されたファイルを確認
    try {
      await fs.access(outputFilePath);
    } catch {
      throw new Error('Failed to generate PPTX file');
    }

    // Supabaseにアップロード（設定されている場合）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      try {
        // ファイルを読み込み
        const fileBuffer = await fs.readFile(outputFilePath);
        const fileName = `translated_${tempId}.pptx`;
        
        // Supabaseにアップロード
        const { data, error } = await supabase.storage
          .from('presentations')
          .upload(fileName, fileBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            upsert: false
          });

        if (error) {
          logger.error('Supabase upload error:', error);
          throw error;
        }

        // 公開URLを取得
        const { data: urlData } = supabase.storage
          .from('presentations')
          .getPublicUrl(fileName);

        logger.info('PPTX uploaded to Supabase', {
          fileName,
          url: urlData.publicUrl
        });

        // 一時ファイルをクリーンアップ
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        return NextResponse.json({
          success: true,
          downloadUrl: urlData.publicUrl,
          fileName,
          message: 'PPTXファイルが正常に生成されました'
        });

      } catch (uploadError) {
        logger.error('Failed to upload to Supabase, using local file', uploadError);
        // Supabaseアップロードが失敗した場合はローカルファイルを返す
      }
    }

    // Supabaseが設定されていない、またはアップロードに失敗した場合
    // ローカルファイルをBase64エンコードして返す
    const fileBuffer = await fs.readFile(outputFilePath);
    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64Data}`;

    // 一時ファイルをクリーンアップ
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({
      success: true,
      downloadUrl: dataUrl,
      fileName: 'translated_presentation.pptx',
      message: 'PPTXファイルが正常に生成されました（ローカル）'
    });

  } catch (error) {
    logger.error('PPTX generation API error', error);
    
    // 一時ファイルをクリーンアップ
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'PPTX generation failed' 
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
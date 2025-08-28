import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import logger from '@/lib/logger';
import { getTranslationService } from '@/lib/translation/pptx-translation-service';
import { TranslationConfig } from '@/lib/translation/claude-translator';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';

const execAsync = promisify(exec);

// Supabaseクライアント初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // セキュリティチェックを追加（非常に重い処理のため厳しいレート制限）
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      max: 5,
      windowMs: 60 * 1000, // 1分あたり5リクエスト（非常に重い処理）
    },
    contentType: 'application/json',
    methods: ['POST'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  const requestId = securityCheck.requestId;
  
  try {
    // ユーザー認証の確認
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      logger.warn('Unauthorized translate-pptx attempt', { requestId });
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    const { fileId, sourceLanguage = 'auto-detect', targetLanguage = 'ja' } = await request.json();
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // ファイル情報を取得
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // ステータスを処理中に更新
    await supabase
      .from('files')
      .update({ status: 'processing' })
      .eq('id', fileId);

    // Storageからファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(fileRecord.storage_path);

    if (downloadError || !fileData) {
      throw new Error('Failed to download file');
    }

    // 一時ファイルとして保存
    const tempDir = '/tmp';
    const tempInputPath = path.join(tempDir, `input_${fileId}.pptx`);
    const tempOutputPath = path.join(tempDir, `output_${fileId}.pptx`);
    
    const buffer = await fileData.arrayBuffer();
    await fs.writeFile(tempInputPath, Buffer.from(buffer));

    // PowerPointからテキストを抽出
    const extractScript = path.join(process.cwd(), 'src/lib/pptx/extract_text.py');
    const { stdout: extractOutput } = await execAsync(
      `cd ${process.cwd()} && python3 ${extractScript} ${tempInputPath}`
    );
    
    const extractedData = JSON.parse(extractOutput);
    
    if (!extractedData.success) {
      throw new Error(extractedData.error || 'Failed to extract text');
    }

    // Real AI translation using Claude API
    const translationService = getTranslationService();
    
    // Set up progress tracking (could be extended to WebSocket or SSE)
    translationService.setProgressCallback((progress) => {
      logger.info('Translation progress:', { ...progress });
      
      // Update file status with progress
      supabase
        .from('files')
        .update({ 
          status: 'processing',
          translation_result: {
            progress: progress.percentage,
            current_slide: progress.current_slide,
            message: progress.message
          }
        })
        .eq('id', fileId)
        .then(({ error }) => {
          if (error) {
            logger.error('Failed to update progress:', error);
          }
        });
    });

    // Configure translation
    const translationConfig: Omit<TranslationConfig, 'documentType'> = {
      sourceLanguage,
      targetLanguage,
      preserveFormatting: true
    };

    // Translate the presentation
    const translatedSlides = await translationService.translatePresentation(
      extractedData.slides,
      translationConfig
    );

    // Optimize translations for better quality
    const optimizedSlides = await translationService.optimizeTranslations(
      translatedSlides,
      { ...translationConfig, documentType: 'general' }
    );

    // Format translations for Python script
    const translations = translationService.formatForPythonScript(optimizedSlides);

    // 翻訳されたテキストでPowerPointを更新
    const updateScript = path.join(process.cwd(), 'src/lib/pptx/update_pptx.py');
    const { stdout: updateOutput } = await execAsync(
      `cd ${process.cwd()} && python3 ${updateScript} ${tempInputPath} ${tempOutputPath} '${JSON.stringify(translations)}'`
    );
    
    const updateResult = JSON.parse(updateOutput);
    
    if (!updateResult.success) {
      throw new Error(updateResult.error || 'Failed to update PowerPoint');
    }

    // 翻訳済みファイルをStorageにアップロード
    const translatedFile = await fs.readFile(tempOutputPath);
    const translatedFileName = `${fileRecord.user_id}/translated_${Date.now()}_${fileRecord.original_filename}`;
    
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(translatedFileName, translatedFile);

    if (uploadError) {
      throw new Error('Failed to upload translated file');
    }

    // ファイルレコードを更新
    const { error: updateError } = await supabase
      .from('files')
      .update({
        status: 'completed',
        translation_result: {
          translated_path: translatedFileName,
          slide_count: extractedData.total_slides,
          updated_count: updateResult.updated_count,
          completed_at: new Date().toISOString()
        }
      })
      .eq('id', fileId);

    if (updateError) {
      throw new Error('Failed to update file record');
    }

    // 一時ファイルをクリーンアップ
    await fs.unlink(tempInputPath).catch(() => {});
    await fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Translation completed',
      translated_path: translatedFileName,
      slide_count: extractedData.total_slides
    });

  } catch (error) {
    logger.error('Translation error:', error);
    
    // エラー時はステータスをfailedに更新
    try {
      const body = await request.json().catch(() => ({}));
      if (body.fileId) {
        await supabase
          .from('files')
          .update({ 
            status: 'failed',
            translation_result: {
              error: error instanceof Error ? error.message : 'Translation failed',
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', body.fileId);
      }
    } catch (e) {
      logger.error('Failed to update status:', e);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 }
    );
  }
}
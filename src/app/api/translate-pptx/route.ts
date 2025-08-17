import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import logger from '@/lib/logger';

const execAsync = promisify(exec);

// Supabaseクライアント初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { fileId } = await request.json();
    
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

    // 翻訳処理（デモ用の簡易実装）
    const translations: Record<number, any[]> = {};
    
    for (const slide of extractedData.slides) {
      const slideTranslations = [];
      
      for (const text of slide.texts) {
        if (text.text) {
          // デモ用：簡単な翻訳ルール
          let translatedText = text.text;
          
          // 基本的な英日翻訳の例
          const translationMap: Record<string, string> = {
            'Test Presentation': 'テストプレゼンテーション',
            'Sample Content': 'サンプルコンテンツ',
            'First bullet point': '最初の箇条書き',
            'Second bullet point': '2番目の箇条書き',
            'Third bullet point': '3番目の箇条書き',
            'This is a test PowerPoint file for upload testing': 'これはアップロードテスト用のPowerPointファイルです',
            'This is a custom text box': 'これはカスタムテキストボックスです'
          };
          
          // マッピングで翻訳
          for (const [en, ja] of Object.entries(translationMap)) {
            translatedText = translatedText.replace(en, ja);
          }
          
          // 箇条書きの記号を変換
          translatedText = translatedText.replace(/•/g, '・');
          
          slideTranslations.push({
            ...text,
            translated_text: translatedText
          });
        } else if (text.table) {
          // テーブルの翻訳
          const translatedTable = text.table.map((row: string[]) =>
            row.map((cell: string) => {
              // 簡単な翻訳
              let translated = cell;
              if (cell.includes('Test')) translated = cell.replace('Test', 'テスト');
              if (cell.includes('Sample')) translated = translated.replace('Sample', 'サンプル');
              return translated;
            })
          );
          
          slideTranslations.push({
            ...text,
            translated_table: translatedTable
          });
        }
      }
      
      translations[slide.slide_number] = slideTranslations;
    }

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
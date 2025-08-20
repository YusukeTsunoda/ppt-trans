import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { fileId, filePath, translations } = await request.json();
    
    if (!fileId || !filePath || !translations) {
      return NextResponse.json(
        { success: false, error: '必要な情報が不足しています' },
        { status: 400 }
      );
    }
    
    // Supabaseクライアントを作成
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      );
    }
    
    // ファイルの所有権を確認
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが見つかりません' },
        { status: 404 }
      );
    }
    
    // Supabase Storageから元のファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(filePath);
    
    if (downloadError || !fileData) {
      logger.error('Download error:', downloadError);
      return NextResponse.json(
        { success: false, error: 'ファイルのダウンロードに失敗しました' },
        { status: 500 }
      );
    }
    
    // 一時ファイルとして保存
    const tempDir = '/tmp';
    const inputFilePath = path.join(tempDir, `input_${fileId}.pptx`);
    const outputFilePath = path.join(tempDir, `translated_${fileId}.pptx`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(inputFilePath, buffer);
    
    // 翻訳データを整形（シェイプインデックスを追加）
    const formattedTranslations = {
      slides: translations.slides.map((slide: any) => ({
        slide_number: slide.slide_number,
        translations: slide.translations.map((text: any, index: number) => ({
          original: text.original,
          translated: text.translated || text.original,
          shape_index: index,
          // テーブルの場合の処理
          table_translations: text.isTable ? text.tableData : null
        }))
      }))
    };
    
    // Pythonスクリプトを実行して翻訳を適用
    const pythonScriptPath = path.join(process.cwd(), 'src/lib/pptx/apply_translations.py');
    
    // 仮想環境のPythonを使用（仮想環境が存在する場合）
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    const pythonExecutable = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonExecutable, [
        pythonScriptPath,
        inputFilePath,
        outputFilePath,
        JSON.stringify(formattedTranslations)
      ]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        // 入力ファイルを削除
        try {
          await fs.unlink(inputFilePath);
        } catch (err) {
          logger.error('Failed to delete input temp file:', err);
        }
        
        if (code !== 0) {
          logger.error('Python script error:', errorData);
          // 出力ファイルも削除
          try {
            await fs.unlink(outputFilePath);
          } catch (err) {
            // エラーは無視
          }
          resolve(
            NextResponse.json(
              { 
                success: false, 
                error: '翻訳の適用に失敗しました',
                details: errorData 
              },
              { status: 500 }
            )
          );
          return;
        }
        
        try {
          const result = JSON.parse(outputData);
          
          if (!result.success) {
            // 出力ファイルを削除
            try {
              await fs.unlink(outputFilePath);
            } catch (err) {
              // エラーは無視
            }
            resolve(
              NextResponse.json(
                { 
                  success: false, 
                  error: result.error || '翻訳の適用に失敗しました' 
                },
                { status: 500 }
              )
            );
            return;
          }
          
          // 翻訳済みファイルを読み込む
          const translatedFile = await fs.readFile(outputFilePath);
          
          // 一時ファイルを削除
          try {
            await fs.unlink(outputFilePath);
          } catch (err) {
            logger.error('Failed to delete output temp file:', err);
          }
          
          // ファイル名を生成
          const originalName = file.original_name || 'presentation.pptx';
          const nameWithoutExt = originalName.replace(/\.pptx$/i, '');
          const translatedFileName = `${nameWithoutExt}_translated.pptx`;
          
          // ファイルをBase64エンコード
          const base64Data = translatedFile.toString('base64');
          const dataUri = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${base64Data}`;
          
          resolve(
            NextResponse.json({
              success: true,
              dataUri: dataUri,
              fileName: translatedFileName,
              appliedCount: result.applied_count,
              message: result.message
            })
          );
        } catch (parseError) {
          logger.error('JSON parse error:', parseError);
          // 出力ファイルを削除
          try {
            await fs.unlink(outputFilePath);
          } catch (err) {
            // エラーは無視
          }
          resolve(
            NextResponse.json(
              { 
                success: false, 
                error: '結果の解析に失敗しました' 
              },
              { status: 500 }
            )
          );
        }
      });
    }) as Promise<NextResponse>;
  } catch (error) {
    logger.error('Apply translations API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '予期しないエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}
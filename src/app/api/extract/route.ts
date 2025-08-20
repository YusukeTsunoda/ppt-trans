import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { fileId, filePath } = await request.json();
    
    if (!fileId || !filePath) {
      return NextResponse.json(
        { success: false, error: 'ファイル情報が不足しています' },
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
    
    // Supabase Storageからファイルをダウンロード
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
    const tempFilePath = path.join(tempDir, `temp_${fileId}.pptx`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);
    
    // Pythonスクリプトを実行してテキストを抽出
    const pythonScriptPath = path.join(process.cwd(), 'src/lib/pptx/extract_text.py');
    
    // 仮想環境のPythonを使用（仮想環境が存在する場合）
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    const pythonExecutable = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');
    
    return new Promise((resolve) => {
      const pythonProcess = spawn(pythonExecutable, [pythonScriptPath, tempFilePath]);
      
      let outputData = '';
      let errorData = '';
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        // 一時ファイルを削除（ファイルが存在する場合のみ）
        try {
          await fs.access(tempFilePath);
          await fs.unlink(tempFilePath);
        } catch (err) {
          // ファイルが存在しない場合は無視
          if (err.code !== 'ENOENT') {
            logger.error('Failed to delete temp file:', err);
          }
        }
        
        if (code !== 0) {
          logger.error('Python script error:', errorData);
          resolve(
            NextResponse.json(
              { 
                success: false, 
                error: 'テキスト抽出に失敗しました',
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
            resolve(
              NextResponse.json(
                { 
                  success: false, 
                  error: result.error || 'テキスト抽出に失敗しました' 
                },
                { status: 500 }
              )
            );
            return;
          }
          
          resolve(
            NextResponse.json({
              success: true,
              data: result
            })
          );
        } catch (parseError) {
          logger.error('JSON parse error:', parseError);
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
    logger.error('Extract API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '予期しないエラーが発生しました' 
      },
      { status: 500 }
    );
  }
}
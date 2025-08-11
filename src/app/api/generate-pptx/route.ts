import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const execAsync = promisify(exec);

// Supabaseクライアントの初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  let tempInputFile: string | null = null;
  let tempOutputFile: string | null = null;
  let jsonFile: string | null = null;
  
  try {
    const { originalFileUrl, editedSlides } = await request.json();
    
    if (!originalFileUrl || !editedSlides) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    console.log('Generating translated PPTX...');
    console.log('Original file URL:', originalFileUrl);
    console.log('Number of slides to process:', editedSlides.length);

    // 一時ディレクトリを作成
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // 元のPPTXファイルをダウンロード
    console.log('Downloading original PPTX file...');
    const response = await fetch(originalFileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download original file: ${response.statusText}`);
    }
    
    const originalBuffer = await response.arrayBuffer();
    tempInputFile = path.join(tempDir, `input_${uuidv4()}.pptx`);
    await fs.writeFile(tempInputFile, Buffer.from(originalBuffer));
    
    // 出力ファイルのパスを設定
    tempOutputFile = path.join(tempDir, `output_${uuidv4()}.pptx`);
    
    // Pythonスクリプトを実行
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_pptx.py');
    
    // JSONをファイルに書き込む（コマンドラインの長さ制限を回避）
    jsonFile = path.join(tempDir, `slides_${uuidv4()}.json`);
    await fs.writeFile(jsonFile, JSON.stringify(editedSlides));
    
    console.log('Running Python script to generate translated PPTX...');
    const command = `uv run python "${scriptPath}" "${tempInputFile}" "${jsonFile}" "${tempOutputFile}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });
      
      if (stderr && !stderr.includes('INFO')) {
        console.error('Python script stderr:', stderr);
      }
      
      console.log('Python script output:', stdout);
      
      // 生成されたファイルを読み込む
      const outputBuffer = await fs.readFile(tempOutputFile);
      
      // Supabaseにアップロード
      const fileName = `translated_${uuidv4()}.pptx`;
      
      // バケットの存在確認（process-pptxで作成済みの場合はスキップされる）
      try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
          console.warn('Could not list buckets, attempting to use existing bucket:', listError);
        } else {
          const bucketExists = buckets?.some(bucket => bucket.name === 'pptx-files');
          
          if (!bucketExists) {
            console.log('Creating pptx-files bucket...');
            const { error: createError } = await supabase.storage.createBucket('pptx-files', {
              public: true,
              fileSizeLimit: 52428800, // 50MB
            });
            
            if (createError) {
              console.warn('Failed to create bucket (might already exist):', createError.message);
              // Continue anyway - bucket might already exist
            }
          }
        }
      } catch (bucketError) {
        console.warn('Bucket check/creation failed, continuing anyway:', bucketError);
        // Continue anyway - we'll try to upload and see if it works
      }
      
      const { error: uploadError } = await supabase.storage
        .from('pptx-files')
        .upload(fileName, outputBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: true, // 同じファイル名が存在する場合は上書き
        });
      
      if (uploadError) {
        console.error('Upload error details:', uploadError);
        throw new Error(`Failed to upload translated file: ${uploadError.message || JSON.stringify(uploadError)}`);
      }
      
      // 公開URLを取得
      const { data: urlData } = supabase.storage
        .from('pptx-files')
        .getPublicUrl(fileName);
      
      console.log('Translated PPTX uploaded successfully:', urlData.publicUrl);
      
      // 一時ファイルを削除
      await fs.unlink(tempInputFile).catch(() => {});
      await fs.unlink(tempOutputFile).catch(() => {});
      await fs.unlink(jsonFile).catch(() => {});
      
      // CORSヘッダーを追加して返す
      const response = NextResponse.json({
        success: true,
        downloadUrl: urlData.publicUrl,
        fileName: fileName
      });
      
      // CORS対応
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      
      return response;
      
    } catch (execError: any) {
      console.error('Python script execution error:', execError);
      
      // Pythonスクリプトのエラー出力を解析
      let errorMessage = 'PPTXファイルの生成に失敗しました';
      if (execError.stdout) {
        try {
          const output = JSON.parse(execError.stdout);
          if (output.error) {
            errorMessage = output.error;
          }
        } catch {
          // JSON解析に失敗した場合はデフォルトメッセージを使用
          errorMessage = `PPTXファイルの生成に失敗しました: ${execError.message || execError}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
  } catch (error: any) {
    console.error('Generate PPTX error:', error);
    
    // 一時ファイルをクリーンアップ
    if (tempInputFile) {
      await fs.unlink(tempInputFile).catch(() => {});
    }
    if (tempOutputFile) {
      await fs.unlink(tempOutputFile).catch(() => {});
    }
    if (jsonFile) {
      await fs.unlink(jsonFile).catch(() => {});
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'PPTXファイルの生成中にエラーが発生しました',
        details: error.toString()
      },
      { status: 500 }
    );
  }
}

// プリフライトリクエスト対応
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// ダウンロード用のGETエンドポイント
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fileUrl = searchParams.get('url');
  
  if (!fileUrl) {
    return NextResponse.json(
      { error: 'ファイルURLが指定されていません' },
      { status: 400 }
    );
  }
  
  try {
    // ファイルをダウンロード
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    
    // ファイルを返す
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="translated_presentation.pptx"',
      },
    });
    
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'ファイルのダウンロードに失敗しました' },
      { status: 500 }
    );
  }
}
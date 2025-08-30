'use server';

import { createClient } from '@/lib/supabase/server';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);
import path from 'path';
import fs from 'fs/promises';
import logger from '@/lib/logger';
import { translateTextsAction } from './translate';
import {
  extractTextFromPPTXSchema,
  applyTranslationsSchema,
  translatePPTXSchema,
  validateInput
} from '@/lib/validation/server-actions';
import { createRateLimiter } from '@/lib/security/rate-limiter';

export interface ExtractResult {
  success: boolean;
  extractedTexts?: any;
  error?: string;
}

export interface ApplyTranslationsResult {
  success: boolean;
  translatedPath?: string;
  downloadUrl?: string;
  error?: string;
}

export interface TranslatePPTXResult {
  success: boolean;
  message?: string;
  fileId?: string;
  error?: string;
}

/**
 * PPTXファイルからテキストを抽出する
 * @param fileId ファイルID
 * @param filePath ストレージのファイルパス
 * @returns 抽出されたテキスト
 */
export async function extractTextFromPPTXAction(
  fileId: unknown,
  filePath: unknown
): Promise<ExtractResult> {
  try {
    // 入力検証
    const validation = validateInput(extractTextFromPPTXSchema, { fileId, filePath });
    if (!validation.success) {
      return {
        success: false,
        error: `入力エラー: ${validation.error}`
      };
    }
    
    const validatedData = validation.data;
    
    // Supabaseクライアントを作成
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // レート制限チェック
    const rateLimiter = createRateLimiter('extractText', user.id);
    const rateLimit = await rateLimiter(validatedData.fileId);
    
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `レート制限に達しました。${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)}秒後に再試行してください。`
      };
    }
    
    // ファイルの所有権を確認
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', validatedData.fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return {
        success: false,
        error: 'ファイルが見つかりません'
      };
    }
    
    // Supabase Storageからファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(validatedData.filePath);
    
    if (downloadError || !fileData) {
      logger.error('Download error:', downloadError);
      return {
        success: false,
        error: 'ファイルのダウンロードに失敗しました'
      };
    }
    
    // 一時ファイルとして保存
    const tempDir = '/tmp';
    const tempFilePath = path.join(tempDir, `temp_${validatedData.fileId}.pptx`);
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
      let isTimedOut = false;
      
      // タイムアウト設定（30秒）
      const timeout = setTimeout(() => {
        isTimedOut = true;
        pythonProcess.kill();
        resolve({
          success: false,
          error: 'テキスト抽出がタイムアウトしました'
        });
      }, 30000);
      
      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        clearTimeout(timeout);
        
        if (isTimedOut) return;
        
        // 一時ファイルを削除
        try {
          await fs.unlink(tempFilePath);
        } catch (error) {
          logger.error('Temp file cleanup error:', error);
        }
        
        if (code !== 0) {
          logger.error('Python script error:', errorData);
          resolve({
            success: false,
            error: 'テキスト抽出に失敗しました'
          });
          return;
        }
        
        try {
          const extractedTexts = JSON.parse(outputData);
          resolve({
            success: true,
            extractedTexts
          });
        } catch (parseError) {
          logger.error('JSON parse error:', parseError);
          resolve({
            success: false,
            error: 'テキスト抽出結果の解析に失敗しました'
          });
        }
      });
    });
  } catch (error) {
    logger.error('Extract action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'テキスト抽出中にエラーが発生しました'
    };
  }
}

/**
 * 翻訳結果をPPTXファイルに適用する
 * @param fileId ファイルID
 * @param filePath ストレージのファイルパス
 * @param translations 翻訳データ
 * @returns 翻訳済みファイルのパス
 */
export async function applyTranslationsAction(
  fileId: unknown,
  filePath: unknown,
  translations: unknown
): Promise<ApplyTranslationsResult> {
  logger.info('applyTranslationsAction called with:', {
    fileId: typeof fileId,
    filePath: typeof filePath,
    translations: typeof translations,
    hasTranslations: !!translations
  });
  
  try {
    // 入力検証
    const validation = validateInput(applyTranslationsSchema, { fileId, filePath, translations });
    if (!validation.success) {
      logger.error('Validation failed:', validation.error);
      return {
        success: false,
        error: `入力エラー: ${validation.error}`
      };
    }
    
    const validatedData = validation.data;
    
    // Supabaseクライアントを作成
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // レート制限チェック
    const rateLimiter = createRateLimiter('applyTranslations', user.id);
    const rateLimit = await rateLimiter(validatedData.fileId);
    
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `レート制限に達しました。${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)}秒後に再試行してください。`
      };
    }
    
    // ファイルの所有権を確認
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', validatedData.fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return {
        success: false,
        error: 'ファイルが見つかりません'
      };
    }
    
    // Supabase Storageから元のファイルをダウンロード
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('uploads')
      .download(validatedData.filePath);
    
    if (downloadError || !fileData) {
      logger.error('Download error:', downloadError);
      return {
        success: false,
        error: 'ファイルのダウンロードに失敗しました'
      };
    }
    
    // 一時ファイルとして保存
    const tempDir = '/tmp';
    const inputFilePath = path.join(tempDir, `input_${validatedData.fileId}.pptx`);
    const outputFilePath = path.join(tempDir, `translated_${validatedData.fileId}.pptx`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(inputFilePath, buffer);
    
    // 翻訳データを整形（シェイプインデックスを追加）
    const formattedTranslations = {
      slides: validatedData.translations.slides?.map((slide: any) => ({
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
    
    // 翻訳データをJSONファイルとして保存
    const translationsFilePath = path.join(tempDir, `translations_${validatedData.fileId}.json`);
    await fs.writeFile(translationsFilePath, JSON.stringify(formattedTranslations, null, 2));
    
    // Pythonスクリプトを実行して翻訳を適用
    const pythonScriptPath = path.join(process.cwd(), 'src/lib/pptx/apply_translations.py');
    
    // 仮想環境のPythonを使用（仮想環境が存在する場合）
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python');
    const pythonExecutable = await fs.access(venvPython).then(() => venvPython).catch(() => 'python3');
    
    // Pythonスクリプトを実行
    logger.info('Starting Python script:', {
      executable: pythonExecutable,
      script: pythonScriptPath,
      input: inputFilePath,
      output: outputFilePath,
      translations: translationsFilePath
    });
    
    let pythonResult;
    try {
      const { stdout, stderr } = await execFileAsync(
        pythonExecutable,
        [
          pythonScriptPath,
          inputFilePath,
          outputFilePath,
          translationsFilePath
        ],
        {
          timeout: 60000, // 60秒のタイムアウト
          maxBuffer: 10 * 1024 * 1024 // 10MBのバッファ
        }
      );
      
      pythonResult = { stdout, stderr, success: true };
      logger.info('Python script output:', stdout?.substring(0, 200) || '');
      if (stderr) {
        logger.warn('Python script stderr:', stderr);
      }
    } catch (error: any) {
      logger.error('Python script error:', error);
      pythonResult = {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        success: false
      };
    }
        
    // 一時ファイルを削除
    try {
      await fs.unlink(inputFilePath);
      await fs.unlink(translationsFilePath);
    } catch (error) {
      logger.error('Temp file cleanup error:', error);
    }
    
    if (!pythonResult.success) {
      logger.error('Python script failed:', pythonResult);
      try {
        await fs.unlink(outputFilePath);
      } catch {}
      return {
        success: false,
        error: '翻訳の適用に失敗しました'
      };
    }
    
    // Log successful Python script output
    logger.info('Python script completed successfully:', pythonResult);
        
    
    let translatedPath = '';
    try {
      // Check if the output file was actually created
      const fileExists = await fs.access(outputFilePath).then(() => true).catch(() => false);
      logger.info('Checking output file:', {
        path: outputFilePath,
        exists: fileExists
      });
      
      if (!fileExists) {
        throw new Error(`Output file does not exist: ${outputFilePath}`);
      }
      
      // 翻訳済みファイルをStorageにアップロード
      const translatedBuffer = await fs.readFile(outputFilePath);
      logger.info('Read translated file:', {
        path: outputFilePath,
        size: translatedBuffer.length
      });
      
      translatedPath = `${user.id}/translated_${Date.now()}_${file.original_name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(translatedPath, translatedBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          upsert: false
        });
      
      if (uploadError) {
        logger.error('Storage upload error:', {
          error: uploadError.message || uploadError,
          path: translatedPath,
          fileSize: translatedBuffer.length
        });
        throw uploadError;
      }
      
      // データベースを更新（extracted_dataを更新して翻訳済みパスを保存）
      const { data: currentFile } = await supabase
        .from('files')
        .select('extracted_data')
        .eq('id', validatedData.fileId)
        .single();
      
      const updatedExtractedData = {
        ...(currentFile?.extracted_data || {}),
        translated_path: translatedPath,
        translation_completed_at: new Date().toISOString()
      };
      
      const { error: updateError } = await supabase
        .from('files')
        .update({
          status: 'completed',
          extracted_data: updatedExtractedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedData.fileId);
      
      logger.info('Database update result:', {
        hasError: !!updateError,
        fileId: validatedData.fileId,
        translatedPath: translatedPath
      });
      
      if (updateError) {
        logger.error('Database update error:', {
          error: updateError.message || JSON.stringify(updateError),
          code: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          fileId: validatedData.fileId
        });
        
        // データベース更新に失敗した場合は、アップロードしたファイルを削除してエラーを返す
        try {
          await supabase.storage
            .from('uploads')
            .remove([translatedPath]);
        } catch (removeError) {
          logger.error('Failed to remove uploaded file after DB error:', removeError);
        }
        
        // 一時ファイルを削除
        try {
          await fs.unlink(outputFilePath);
        } catch {}
        
        return {
          success: false,
          error: `データベースの更新に失敗しました: ${updateError.message || 'Unknown error'}`
        };
      }
      
      // 一時ファイルを削除
      await fs.unlink(outputFilePath);
      
      logger.info('Translation application completed successfully:', {
        fileId: validatedData.fileId,
        translatedPath: translatedPath
      });
      
      // ダウンロード用の署名付きURLを生成
      const { data: urlData, error: urlError } = await supabase.storage
        .from('uploads')
        .createSignedUrl(translatedPath, 60); // 60秒間有効
      
      if (urlError || !urlData) {
        logger.error('Failed to create signed URL:', urlError);
        return {
          success: true,
          translatedPath,
          // URLが生成できない場合でもパスは返す
        };
      }
      
      return {
        success: true,
        translatedPath,
        downloadUrl: urlData.signedUrl
      };
    } catch (error) {
      logger.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      logger.error('Upload error details:', {
        error: errorMessage,
        translatedPath: translatedPath,
        fileExists: await fs.access(outputFilePath).then(() => true).catch(() => false),
        userId: user.id
      });
      try {
        await fs.unlink(outputFilePath);
      } catch {}
      return {
        success: false,
        error: `翻訳済みファイルのアップロードに失敗しました: ${errorMessage}`
      };
    }
  } catch (error) {
    logger.error('Apply translations action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '翻訳適用中にエラーが発生しました'
    };
  }
}

/**
 * PPTXファイル全体を翻訳する（統合処理）
 * @param fileId ファイルID
 * @param targetLanguage 翻訳先の言語コード（デフォルト: 'ja'）
 * @returns 翻訳結果
 */
export async function translatePPTXAction(
  fileId: unknown,
  targetLanguage: unknown = 'ja'
): Promise<TranslatePPTXResult> {
  try {
    // 入力検証
    const validation = validateInput(translatePPTXSchema, { fileId, targetLanguage });
    if (!validation.success) {
      return {
        success: false,
        error: `入力エラー: ${validation.error}`
      };
    }
    
    const validatedData = validation.data;
    
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return {
        success: false,
        error: '認証が必要です'
      };
    }
    
    // レート制限チェック
    const rateLimiter = createRateLimiter('translatePPTX', user.id);
    const rateLimit = await rateLimiter(validatedData.fileId);
    
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `レート制限に達しました。${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)}秒後に再試行してください。`
      };
    }
    
    // ファイル情報を取得
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', validatedData.fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return {
        success: false,
        error: 'ファイルが見つかりません'
      };
    }
    
    // ステータスを処理中に更新
    await supabase
      .from('files')
      .update({ status: 'processing' })
      .eq('id', validatedData.fileId);
    
    // 1. テキスト抽出
    const extractResult = await extractTextFromPPTXAction(validatedData.fileId, file.filename);
    
    if (!extractResult.success || !extractResult.extractedTexts) {
      await supabase
        .from('files')
        .update({ 
          status: 'failed',
          error_message: extractResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedData.fileId);
      
      return {
        success: false,
        error: extractResult.error || 'テキスト抽出に失敗しました'
      };
    }
    
    // 2. テキスト翻訳
    const textsToTranslate = [];
    for (const slide of extractResult.extractedTexts.slides) {
      for (const text of slide.texts) {
        textsToTranslate.push({
          id: `${slide.slide_number}_${text.shape_index || 0}`,
          text: text.text
        });
      }
    }
    
    const translateResult = await translateTextsAction(textsToTranslate, validatedData.targetLanguage);
    
    if (!translateResult.success || !translateResult.translations) {
      await supabase
        .from('files')
        .update({ 
          status: 'failed',
          error_message: translateResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedData.fileId);
      
      return {
        success: false,
        error: translateResult.error || '翻訳に失敗しました'
      };
    }
    
    // 3. 翻訳結果を整形
    const translationMap = new Map(
      translateResult.translations.map(t => [t.id, t.translated])
    );
    
    const formattedTranslations = {
      slides: extractResult.extractedTexts.slides.map((slide: any) => ({
        slide_number: slide.slide_number,
        translations: slide.texts.map((text: any) => ({
          original: text.text,
          translated: translationMap.get(`${slide.slide_number}_${text.shape_index || 0}`) || text.text
        }))
      }))
    };
    
    // 4. 翻訳結果を適用
    const applyResult = await applyTranslationsAction(validatedData.fileId, file.filename, formattedTranslations);
    
    if (!applyResult.success) {
      await supabase
        .from('files')
        .update({ 
          status: 'failed',
          error_message: applyResult.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', validatedData.fileId);
      
      return {
        success: false,
        error: applyResult.error || '翻訳の適用に失敗しました'
      };
    }
    
    return {
      success: true,
      message: '翻訳が完了しました',
      fileId: String(fileId)
    };
    
  } catch (error) {
    logger.error('Translate PPTX action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '翻訳処理中にエラーが発生しました'
    };
  }
}
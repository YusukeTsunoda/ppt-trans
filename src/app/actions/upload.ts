'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ALLOWED_MIME_TYPES, FILE_SIZE_LIMITS } from '@/constants/mime-types';
import logger from '@/lib/logger';

export interface UploadState {
  error?: string;
  success?: boolean;
  message?: string;
  fileId?: string;
}

function isValidMimeType(mimeType: string): boolean {
  return Object.values(ALLOWED_MIME_TYPES).includes(mimeType as any);
}

// ファイルアップロードアクション
export async function uploadFileAction(
  prevState: UploadState | null,
  formData: FormData
): Promise<UploadState> {
  // タイムアウトを設定（30秒）
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const file = formData.get('file') as File;
    
    if (!file || file.size === 0) {
      return { error: 'ファイルを選択してください' };
    }

    // ファイルサイズの検証
    if (file.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
      return { 
        error: `ファイルサイズが大きすぎます。最大${FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}までアップロード可能です。（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）`
      };
    }

    // MIMEタイプの検証
    if (!isValidMimeType(file.type)) {
      return { 
        error: 'PowerPointファイル（.ppt, .pptx）のみアップロード可能です' 
      };
    }

    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: '認証が必要です。ログインしてください。' };
    }

    // ファイルをBufferに変換
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // ユニークなファイル名の生成
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${user.id}/${timestamp}_${sanitizedFileName}`;

    // Supabase Storageにアップロード（サーバーサイドで実行）
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      logger.error('Storage upload error:', uploadError);
      
      let errorMessage = 'ファイルのアップロードに失敗しました';
      if (uploadError.message?.includes('row-level security')) {
        errorMessage = 'アップロード権限がありません。アカウント設定を確認してください。';
      } else if (uploadError.message?.includes('already exists')) {
        errorMessage = '同名のファイルが既に存在します。';
      }
      
      return { error: errorMessage };
    }

    // データベースにファイル情報を保存
    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert({
        user_id: user.id,
        filename: fileName,
        original_name: file.name,  // original_filename -> original_name に修正
        file_size: buffer.length,
        mime_type: file.type,
        file_path: uploadData.path,  // storage_path -> file_path に修正
        status: 'uploaded'
      })
      .select()
      .single();

    if (dbError) {
      logger.error('Database insert error:', dbError);
      
      // ストレージからファイルを削除（ロールバック）
      await supabase.storage.from('uploads').remove([fileName]);
      
      return { 
        error: 'ファイル情報の保存に失敗しました。もう一度お試しください。'
      };
    }

    // ページを再検証
    revalidatePath('/dashboard');
    revalidatePath('/files');
    
    clearTimeout(timeoutId);

    return {
      success: true,
      message: 'ファイルが正常にアップロードされました',
      fileId: fileRecord.id
    };

  } catch (error: any) {
    clearTimeout(timeoutId);
    logger.error('Upload action error:', error);
    
    // タイムアウトエラーの場合
    if (error.name === 'AbortError') {
      return { 
        error: 'タイムアウト: アップロードに時間がかかりすぎています。もう一度お試しください。'
      };
    }
    
    return { 
      error: '予期しないエラーが発生しました。もう一度お試しください。'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

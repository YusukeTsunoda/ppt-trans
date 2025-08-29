'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ALLOWED_MIME_TYPES } from '@/constants/mime-types';

export interface UploadState {
  error?: string;
  success?: boolean;
  message?: string;
  fileId?: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function isValidMimeType(mimeType: string): boolean {
  return Object.values(ALLOWED_MIME_TYPES).includes(mimeType as any);
}

// ファイルアップロードアクション
export async function uploadFileAction(
  prevState: UploadState | null,
  formData: FormData
): Promise<UploadState> {
  try {
    const file = formData.get('file') as File;
    
    if (!file || file.size === 0) {
      return { error: 'ファイルを選択してください' };
    }

    // ファイルサイズの検証
    if (file.size > MAX_FILE_SIZE) {
      return { 
        error: `ファイルサイズが大きすぎます。最大100MBまでアップロード可能です。（現在: ${(file.size / 1024 / 1024).toFixed(2)}MB）`
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
      console.error('Storage upload error:', uploadError);
      
      let errorMessage = 'ファイルのアップロードに失敗しました';
      if (uploadError.message?.includes('row-level security')) {
        errorMessage = 'アップロード権限がありません。アカウント設定を確認してください。';
      } else if (uploadError.message?.includes('already exists')) {
        errorMessage = '同名のファイルが既に存在します。';
      }
      
      return { error: errorMessage };
    }

    // データベースにファイル情報を保存（カラム名を調整）
    const fileData: any = {
      user_id: user.id,
      filename: fileName,
      file_size: buffer.length,
      mime_type: file.type,
      status: 'uploaded'
    };

    // original_filenameまたはoriginal_nameを試す
    fileData.original_filename = file.name;
    
    // storage_pathまたはfile_pathを試す  
    fileData.storage_path = uploadData.path;

    const { data: fileRecord, error: dbError } = await supabase
      .from('files')
      .insert(fileData)
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      
      // ストレージからファイルを削除（ロールバック）
      await supabase.storage.from('uploads').remove([fileName]);
      
      return { 
        error: 'ファイル情報の保存に失敗しました。もう一度お試しください。'
      };
    }

    // ページを再検証
    revalidatePath('/dashboard');
    revalidatePath('/files');

    return {
      success: true,
      message: 'ファイルが正常にアップロードされました',
      fileId: fileRecord.id
    };

  } catch (error) {
    console.error('Upload action error:', error);
    return { 
      error: '予期しないエラーが発生しました。もう一度お試しください。'
    };
  }
}
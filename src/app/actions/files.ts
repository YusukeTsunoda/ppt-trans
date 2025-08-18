'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { FileRecord } from '@/lib/data/files';
import logger from '@/lib/logger';

export interface FilesState {
  files?: FileRecord[];
  error?: string;
  success?: boolean;
  message?: string;
}

// Server Action for deleting a file
export async function deleteFileAction(
  prevState: FilesState | null,
  formData: FormData
): Promise<FilesState> {
  const supabase = await createClient();
  
  try {
    // 認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: 'Unauthorized' };
    }
    
    const fileId = formData.get('fileId') as string;
    
    if (!fileId) {
      return { error: 'File ID is required' };
    }
    
    // ファイル情報を取得
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      logger.error('File not found:', { fileId, userId: user.id, error: fileError });
      return { error: 'ファイルが見つかりません' };
    }
    
    // ストレージパスを決定（storage_path, file_path, filename のいずれか）
    const storagePath = file.storage_path || file.file_path || file.filename;
    
    if (storagePath) {
      // ストレージからファイルを削除
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([storagePath]);
      
      if (storageError) {
        logger.error('Storage deletion error:', { 
          path: storagePath, 
          error: storageError 
        });
        // ストレージ削除が失敗してもデータベース削除は続行
      }
    }
    
    // 翻訳済みファイルがあれば削除
    if (file.translation_result?.translated_path) {
      const { error: translatedStorageError } = await supabase.storage
        .from('uploads')
        .remove([file.translation_result.translated_path]);
        
      if (translatedStorageError) {
        logger.error('Translated file deletion error:', { 
          path: file.translation_result.translated_path,
          error: translatedStorageError 
        });
      }
    }
    
    // データベースから削除
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id);
    
    if (deleteError) {
      logger.error('Database deletion error:', { 
        fileId,
        error: deleteError 
      });
      return { error: 'ファイルの削除に失敗しました' };
    }
    
    revalidatePath('/files');
    
    return { 
      success: true, 
      message: 'ファイルを削除しました' 
    };
  } catch (error) {
    logger.error('Delete error:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Server Action for downloading a file
export async function downloadFileAction(
  prevState: FilesState | null,
  formData: FormData
): Promise<FilesState> {
  const supabase = await createClient();
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: 'Unauthorized' };
    }
    
    const fileId = formData.get('fileId') as string;
    const fileType = formData.get('fileType') as 'original' | 'translated';
    
    if (!fileId || !fileType) {
      return { error: 'Invalid parameters' };
    }
    
    // ファイル情報を取得
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return { error: 'File not found' };
    }
    
    const path = fileType === 'original' 
      ? file.storage_path 
      : file.translation_result?.translated_path;
    
    if (!path) {
      return { error: 'File path not found' };
    }
    
    // ダウンロード用の署名付きURLを生成
    const { data: urlData, error: urlError } = await supabase.storage
      .from('uploads')
      .createSignedUrl(path, 60); // 60秒間有効
    
    if (urlError || !urlData) {
      return { error: 'Failed to generate download URL' };
    }
    
    return { 
      success: true,
      message: urlData.signedUrl
    };
  } catch (error) {
    logger.error('Download error:', error);
    return { error: 'An unexpected error occurred' };
  }
}
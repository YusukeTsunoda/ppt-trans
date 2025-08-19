'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import logger from '@/lib/logger';

export interface DashboardState {
  error?: string;
  success?: boolean;
  message?: string;
}

export interface TranslateState {
  error?: string;
  success?: boolean;
  message?: string;
  fileId?: string;
}

// ファイル一覧取得（通常の関数として export）
export async function getFiles() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { files: [], error: 'Unauthorized' };
  }
  
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    logger.error('Error fetching files:', error);
    return { files: [], error: error.message };
  }
  
  return { files: data || [], error: null };
}

// 翻訳実行アクション（改善版：直接引数を受け取る）
export async function translateFileAction(fileId: string): Promise<TranslateState> {
  'use server';
  
  try {
    if (!fileId) {
      return { error: 'ファイルIDが指定されていません' };
    }
    
    const supabase = await createClient();
    
    // ユーザー認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: '認証が必要です' };
    }
    
    // ファイルの所有権確認
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fileError || !file) {
      return { error: 'ファイルが見つかりません' };
    }
    
    // 翻訳APIを呼び出す
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/translate-pptx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    });
    
    if (!response.ok) {
      const result = await response.json();
      return { error: result.error || '翻訳に失敗しました' };
    }
    
    // ページを再検証
    revalidatePath('/dashboard');
    
    return {
      success: true,
      message: '翻訳を開始しました',
      fileId
    };
    
  } catch (error) {
    logger.error('Translation error:', error);
    return { error: '翻訳処理中にエラーが発生しました' };
  }
}

// ファイル削除アクション（改善版：直接引数を受け取る）
export async function deleteFileAction(fileId: string): Promise<DashboardState> {
  'use server';
  
  try {
    if (!fileId) {
      return { error: 'ファイルIDが指定されていません' };
    }
    
    const supabase = await createClient();
    
    // ユーザー認証確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: '認証が必要です' };
    }
    
    // ファイル情報を取得
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();
    
    if (fetchError || !file) {
      return { error: 'ファイルが見つかりません' };
    }
    
    // ストレージからファイルを削除
    if (file.filename) {
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([file.filename]);
      
      if (storageError) {
        logger.error('Storage delete error:', storageError);
      }
    }
    
    // データベースからレコードを削除
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', user.id);
    
    if (dbError) {
      return { error: 'ファイルの削除に失敗しました' };
    }
    
    revalidatePath('/dashboard');
    
    return {
      success: true,
      message: 'ファイルを削除しました'
    };
    
  } catch (error) {
    logger.error('Delete error:', error);
    return { error: 'ファイル削除中にエラーが発生しました' };
  }
}
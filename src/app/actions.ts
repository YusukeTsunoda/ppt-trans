'use server';

import { ServerActionState } from '@/lib/server-actions/types';
import { UploadResult, uploadPptxAction as originalUploadAction } from '@/lib/server-actions/files/upload';
import { TranslationResult, batchTranslate as originalBatchTranslate } from '@/lib/server-actions/translate/batch';

// PPTXファイルアップロード Server Action
export async function uploadPptxAction(
  prevState: ServerActionState<UploadResult>,
  formData: FormData
): Promise<ServerActionState<UploadResult>> {
  console.log('=== SERVER ACTION CALLED (app/actions.ts) ===');
  
  try {
    // 実際のアップロード処理を呼び出す
    const result = await originalUploadAction(prevState, formData);
    console.log('Upload result:', result);
    return result;
  } catch (error) {
    console.error('Server Action Error:', error);
    return {
      success: false,
      message: 'エラーが発生しました',
    };
  }
}

// 翻訳 Server Action
export async function batchTranslate(
  prevState: ServerActionState<TranslationResult>,
  formData: FormData
): Promise<ServerActionState<TranslationResult>> {
  console.log('=== TRANSLATE ACTION CALLED (app/actions.ts) ===');
  
  try {
    // 実際の翻訳処理を呼び出す
    const result = await originalBatchTranslate(prevState, formData);
    console.log('Translate result:', result);
    return result;
  } catch (error) {
    console.error('Translate Action Error:', error);
    return {
      success: false,
      message: '翻訳エラーが発生しました',
    };
  }
}
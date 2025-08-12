'use server';

import { ServerActionState } from '@/lib/server-actions/types';
import { batchTranslate as originalBatchTranslate, type TranslationResult } from '@/lib/server-actions/translate/batch';

/**
 * Server Action wrapper for batchTranslate
 * This ensures the action is properly registered with Next.js
 */
export async function batchTranslate(
  prevState: ServerActionState<TranslationResult>,
  formData: FormData
): Promise<ServerActionState<TranslationResult>> {
  console.log('=== App Router Translate Action Called ===');
  
  try {
    // Call the original batch translate action
    const result = await originalBatchTranslate(prevState, formData);
    console.log('Original translate action result:', result);
    return result;
  } catch (error) {
    console.error('Error in app router translate action:', error);
    return {
      success: false,
      message: '翻訳処理中にエラーが発生しました',
      timestamp: Date.now(),
    };
  }
}
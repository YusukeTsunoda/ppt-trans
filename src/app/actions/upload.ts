'use server';

import { ServerActionState } from '@/lib/server-actions/types';
import { uploadPptxAction as originalUploadAction, type UploadResult } from '@/lib/server-actions/files/upload';

/**
 * Server Action wrapper for uploadPptxAction
 * This ensures the action is properly registered with Next.js
 */
export async function uploadPptxAction(
  prevState: ServerActionState<UploadResult>,
  formData: FormData
): Promise<ServerActionState<UploadResult>> {
  console.log('=== App Router Server Action Called ===');
  console.log('Calling original upload action...');
  
  try {
    // Call the original upload action
    const result = await originalUploadAction(prevState, formData);
    console.log('Original upload action result:', result);
    return result;
  } catch (error) {
    console.error('Error in app router server action:', error);
    return {
      success: false,
      message: 'Server Action実行中にエラーが発生しました',
      timestamp: Date.now(),
    };
  }
}
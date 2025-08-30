import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fileId } = await params;
  // セキュリティチェックを追加
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    methods: ['DELETE'],
  });
  
  if (!securityCheck.success) {
    return createErrorResponse(
      securityCheck.error!,
      securityCheck.status!,
      securityCheck.headers,
      securityCheck.requestId
    );
  }
  
  const requestId = securityCheck.requestId;
  
  try {
    // ユーザー認証の確認
    const supabaseServer = await createServerClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      logger.warn('Unauthorized file deletion attempt', { requestId });
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Get file record to find storage path and verify ownership
    const { data: fileRecord, error: fetchError } = await supabase
      .from('files')
      .select('filename, user_id')
      .eq('id', fileId)
      .single();

    if (fetchError || !fileRecord) {
      return createErrorResponse('ファイルが見つかりません', 404, undefined, requestId);
    }
    
    // ファイル所有者の確認（重要：他のユーザーのファイルを削除できないように）
    if (fileRecord.user_id !== user.id) {
      logger.warn('Unauthorized file deletion attempt - wrong owner', { 
        requestId, 
        userId: user.id,
        fileOwnerId: fileRecord.user_id 
      });
      return createErrorResponse('このファイルを削除する権限がありません', 403, undefined, requestId);
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('uploads')
      .remove([fileRecord.filename]);

    if (storageError) {
      logger.error('Failed to delete from storage:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete translated file if exists
    const { data: translatedFile } = await supabase
      .from('files')
      .select('translation_result')
      .eq('id', fileId)
      .single();

    if (translatedFile?.translation_result?.translated_path) {
      await supabase.storage
        .from('uploads')
        .remove([translatedFile.translation_result.translated_path]);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      logger.error('Failed to delete from database:', deleteError);
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return createSuccessResponse(
      { 
        success: true, 
        message: 'ファイルを削除しました' 
      },
      200,
      requestId
    );
  } catch (error) {
    logger.error('Delete file error:', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return createErrorResponse(
      '内部サーバーエラー',
      500,
      undefined,
      requestId
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';
import logger from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // セキュリティチェック（エラーレポートは頻度制限を緩め）
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 60,  // エラーレポートは頻度高めに許可
      windowMs: 60 * 1000,
      identifier: 'error-report',
    },
    contentType: 'application/json',
    methods: ['POST'],
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
    const body = await request.json();
    const { error, errorInfo, userAgent, timestamp, userId } = body;
    
    // エラー情報をログに記録
    logger.error('Client error reported', {
      requestId,
      error: error || 'Unknown error',
      errorInfo,
      userAgent,
      timestamp,
      userId,
    });
    
    // Supabaseのerror_logsテーブルに記録（テーブルが存在する場合）
    try {
      const supabase = await createClient();
      
      // ユーザー認証の確認（オプション）
      let authenticatedUserId = userId;
      if (!authenticatedUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        authenticatedUserId = user?.id;
      }
      
      // エラーログをデータベースに保存（テーブルが存在する場合のみ）
      // TODO: error_logsテーブルを作成後、以下のコメントを解除
      /*
      if (authenticatedUserId) {
        await supabase.from('error_logs').insert({
          user_id: authenticatedUserId,
          error_message: error || 'Unknown error',
          error_stack: errorInfo?.componentStack || errorInfo?.stack,
          user_agent: userAgent,
          occurred_at: timestamp || new Date().toISOString(),
          request_id: requestId,
        });
      }
      */
    } catch (dbError) {
      // データベースエラーは無視（ログは既に記録済み）
      logger.warn('Failed to store error in database', { 
        dbError: dbError instanceof Error ? dbError.message : 'Unknown DB error',
        requestId 
      });
    }
    
    return createSuccessResponse(
      { 
        success: true, 
        message: 'エラーレポートを受信しました',
        requestId 
      },
      200,
      requestId
    );
  } catch (error) {
    logger.error('Error report processing failed:', { 
      requestId, 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return createErrorResponse(
      'エラーレポートの処理に失敗しました',
      500,
      undefined,
      requestId
    );
  }
}
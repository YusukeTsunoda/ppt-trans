import { NextRequest, NextResponse } from 'next/server';
import { CSRFTokenRotation } from '@/lib/security/token-rotation';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

/**
 * トークンローテーション統計情報を取得（管理者のみ）
 */
export async function GET(request: NextRequest) {
  // セキュリティチェック（GETなのでCSRF不要）
  const securityCheck = await performSecurityChecks(request, {
    csrf: false,
    origin: true,
    methods: ['GET'],
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
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    // 管理者権限チェック（簡易版 - 実装に応じて調整）
    // TODO: profilesテーブルからrole確認
    const isAdmin = user.email?.endsWith('@admin.example.com') || 
                   process.env.ADMIN_EMAILS?.split(',').includes(user.email || '');
    
    if (!isAdmin) {
      logger.warn('Non-admin tried to access token stats', {
        requestId,
        userId: user.id,
        email: user.email,
      });
      return createErrorResponse('管理者権限が必要です', 403, undefined, requestId);
    }
    
    // トークンローテーション統計を取得
    const rotation = CSRFTokenRotation.getInstance();
    const stats = rotation.getStatistics();
    
    logger.info('Token rotation stats retrieved', {
      requestId,
      adminId: user.id,
      stats,
    });
    
    return createSuccessResponse({
      stats,
      timestamp: new Date().toISOString(),
      message: 'トークンローテーション統計情報',
    }, 200, requestId);
  } catch (error) {
    logger.error('Failed to get token stats:', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return createErrorResponse(
      '統計情報の取得に失敗しました',
      500,
      undefined,
      requestId
    );
  }
}

/**
 * トークンローテーション設定を更新（管理者のみ）
 */
export async function PATCH(request: NextRequest) {
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 5,
      windowMs: 60 * 1000,
      identifier: 'token-config',
    },
    contentType: 'application/json',
    methods: ['PATCH'],
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
    // ユーザー認証と権限チェック
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    const isAdmin = user.email?.endsWith('@admin.example.com') || 
                   process.env.ADMIN_EMAILS?.split(',').includes(user.email || '');
    
    if (!isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403, undefined, requestId);
    }
    
    // リクエストボディを取得
    const body = await request.json();
    const { rotationInterval, gracePeriod, maxTokensPerUser } = body;
    
    // 設定を更新
    const rotation = CSRFTokenRotation.getInstance();
    const config: any = {};
    
    if (typeof rotationInterval === 'number' && rotationInterval > 0) {
      config.rotationInterval = rotationInterval;
    }
    if (typeof gracePeriod === 'number' && gracePeriod > 0) {
      config.gracePeriod = gracePeriod;
    }
    if (typeof maxTokensPerUser === 'number' && maxTokensPerUser > 0) {
      config.maxTokensPerUser = maxTokensPerUser;
    }
    
    rotation.updateConfig(config);
    
    logger.info('Token rotation config updated', {
      requestId,
      adminId: user.id,
      config,
    });
    
    return createSuccessResponse({
      success: true,
      message: '設定を更新しました',
      config,
    }, 200, requestId);
  } catch (error) {
    logger.error('Failed to update token config:', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return createErrorResponse(
      '設定の更新に失敗しました',
      500,
      undefined,
      requestId
    );
  }
}
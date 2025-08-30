import { NextRequest, NextResponse } from 'next/server';
import { SecurityMonitor } from '@/lib/security/security-monitor';
import { CSRFTokenRotation } from '@/lib/security/token-rotation';
import { performSecurityChecks, createErrorResponse, createSuccessResponse } from '@/lib/security/api-security';
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

/**
 * セキュリティ統計情報を取得（管理者のみ）
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
    // ユーザー認証と権限チェック
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    // 管理者権限チェック（簡易版）
    const isAdmin = user.email?.endsWith('@admin.example.com') || 
                   process.env.ADMIN_EMAILS?.split(',').includes(user.email || '') ||
                   process.env.NODE_ENV === 'development'; // 開発環境では全員アクセス可
    
    if (!isAdmin) {
      logger.warn('Non-admin tried to access security stats', {
        requestId,
        userId: user.id,
        email: user.email,
      });
      return createErrorResponse('管理者権限が必要です', 403, undefined, requestId);
    }
    
    // クエリパラメータから時間窓を取得
    const url = new URL(request.url);
    const windowParam = url.searchParams.get('window');
    const window = windowParam ? parseInt(windowParam) : 3600000; // デフォルト1時間
    
    // セキュリティ監視統計を取得
    const monitor = SecurityMonitor.getInstance();
    const monitorStats = monitor.getStatistics(window);
    const recentAlerts = monitor.getRecentAlerts(10);
    
    // トークンローテーション統計を取得
    const rotation = CSRFTokenRotation.getInstance();
    const tokenStats = rotation.getStatistics();
    
    // データベースから追加統計を取得（テーブルが存在する場合）
    let dbEvents = [];
    try {
      const { data: events } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (events) {
        dbEvents = events;
      }
    } catch (dbError) {
      logger.debug('Could not fetch security events from DB', { dbError });
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      window: window / 1000 / 60, // 分単位で表示
      monitor: {
        ...monitorStats,
        recentAlerts,
      },
      tokens: tokenStats,
      database: {
        recentEvents: dbEvents.length,
        events: dbEvents.slice(0, 20), // 最新20件のみ
      },
      system: {
        environment: process.env.NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };
    
    logger.info('Security stats retrieved', {
      requestId,
      adminId: user.id,
      window,
    });
    
    return createSuccessResponse(response, 200, requestId);
  } catch (error) {
    logger.error('Failed to get security stats:', {
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
 * セキュリティアラートを取得（管理者のみ）
 */
export async function POST(request: NextRequest) {
  const securityCheck = await performSecurityChecks(request, {
    csrf: true,
    origin: true,
    rateLimit: {
      maxRequests: 10,
      windowMs: 60 * 1000,
      identifier: 'security-alerts',
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
    // ユーザー認証と権限チェック
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return createErrorResponse('認証が必要です', 401, undefined, requestId);
    }
    
    const isAdmin = user.email?.endsWith('@admin.example.com') || 
                   process.env.ADMIN_EMAILS?.split(',').includes(user.email || '') ||
                   process.env.NODE_ENV === 'development';
    
    if (!isAdmin) {
      return createErrorResponse('管理者権限が必要です', 403, undefined, requestId);
    }
    
    // リクエストボディを取得
    const body = await request.json();
    const { action, ip } = body;
    
    const monitor = SecurityMonitor.getInstance();
    
    switch (action) {
      case 'unblock_ip':
        if (!ip) {
          return createErrorResponse('IPアドレスが必要です', 400, undefined, requestId);
        }
        
        // IPのブロックを解除（手動で0秒のブロック期間を設定）
        monitor.blockIP(ip, 0);
        
        logger.info('IP manually unblocked', {
          requestId,
          adminId: user.id,
          ip,
        });
        
        return createSuccessResponse({
          success: true,
          message: `IP ${ip} のブロックを解除しました`,
        }, 200, requestId);
        
      case 'block_ip':
        if (!ip) {
          return createErrorResponse('IPアドレスが必要です', 400, undefined, requestId);
        }
        
        const duration = body.duration || 3600000; // デフォルト1時間
        monitor.blockIP(ip, duration);
        
        logger.info('IP manually blocked', {
          requestId,
          adminId: user.id,
          ip,
          duration,
        });
        
        return createSuccessResponse({
          success: true,
          message: `IP ${ip} を ${duration / 1000 / 60} 分間ブロックしました`,
        }, 200, requestId);
        
      case 'reset_alerts':
        monitor.reset();
        
        logger.info('Security monitor reset', {
          requestId,
          adminId: user.id,
        });
        
        return createSuccessResponse({
          success: true,
          message: 'セキュリティ監視をリセットしました',
        }, 200, requestId);
        
      default:
        return createErrorResponse('不明なアクションです', 400, undefined, requestId);
    }
  } catch (error) {
    logger.error('Failed to process security action:', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return createErrorResponse(
      'セキュリティアクションの処理に失敗しました',
      500,
      undefined,
      requestId
    );
  }
}
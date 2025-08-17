import { NextRequest, NextResponse } from 'next/server';
import { getRequestScopedSupabase, validateSession } from '@/lib/auth/request-scoped-auth';
import { getSessionInfo } from '@/lib/auth/session-manager';

interface AuthHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  capabilities: {
    sessionValidation: boolean;
    userRetrieval: boolean;
    profileAccess: boolean;
    tokenRefresh: boolean;
  };
  performance: {
    authCheckTime: number;
    sessionCheckTime: number;
  };
  configuration: {
    supabaseUrlConfigured: boolean;
    supabaseKeyConfigured: boolean;
    authHelpersAvailable: boolean;
  };
  warnings?: string[];
  error?: string;
}

export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const health: AuthHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    capabilities: {
      sessionValidation: false,
      userRetrieval: false,
      profileAccess: false,
      tokenRefresh: false
    },
    performance: {
      authCheckTime: 0,
      sessionCheckTime: 0
    },
    configuration: {
      supabaseUrlConfigured: false,
      supabaseKeyConfigured: false,
      authHelpersAvailable: false
    },
    warnings: []
  };

  try {
    // 設定チェック
    health.configuration.supabaseUrlConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    health.configuration.supabaseKeyConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!health.configuration.supabaseUrlConfigured || !health.configuration.supabaseKeyConfigured) {
      throw new Error('Supabase configuration missing');
    }

    // 認証ヘルパーの可用性チェック
    try {
      const { getCurrentUser } = await import('@/lib/auth-helpers');
      health.configuration.authHelpersAvailable = !!getCurrentUser;
    } catch (_error) {
      health.configuration.authHelpersAvailable = false;
      health.warnings?.push('Auth helpers not available');
    }

    // Supabaseクライアントの取得
    const supabase = await getRequestScopedSupabase();

    // セッション検証のテスト
    const sessionStart = Date.now();
    try {
      const _isValid = await validateSession();
      health.capabilities.sessionValidation = true;
      health.performance.sessionCheckTime = Date.now() - sessionStart;
      
      // セッション情報の詳細チェック
      const sessionInfo = await getSessionInfo();
      
      if (sessionInfo.status === 'expired') {
        health.warnings?.push('Session expired - refresh needed');
      } else if (sessionInfo.isNearExpiry) {
        health.warnings?.push('Session near expiry');
      }
    } catch (_error) {
      health.capabilities.sessionValidation = false;
      health.warnings?.push('Session validation failed');
    }

    // ユーザー取得のテスト
    const authStart = Date.now();
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error) {
        health.capabilities.userRetrieval = true;
        
        // ユーザーが存在する場合、プロファイルアクセスをテスト
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();
          
          if (!profileError && profile) {
            health.capabilities.profileAccess = true;
          } else {
            health.warnings?.push('Profile access failed for authenticated user');
          }
        }
      } else {
        // 認証エラーは必ずしも問題ではない（未認証ユーザーの場合）
        health.capabilities.userRetrieval = true;
        health.warnings?.push('No authenticated user');
      }
      
      health.performance.authCheckTime = Date.now() - authStart;
    } catch (_error) {
      health.capabilities.userRetrieval = false;
      health.status = 'degraded';
      health.warnings?.push('User retrieval failed');
    }

    // トークンリフレッシュ機能のテスト（実際にリフレッシュはしない）
    try {
      // リフレッシュ機能が利用可能かチェック
      const { refreshSession } = supabase.auth;
      health.capabilities.tokenRefresh = !!refreshSession;
    } catch (_error) {
      health.capabilities.tokenRefresh = false;
      health.warnings?.push('Token refresh capability not available');
    }

    // パフォーマンス評価
    if (health.performance.authCheckTime > 1000) {
      health.status = 'degraded';
      health.warnings?.push('Auth check slow');
    }
    
    if (health.performance.sessionCheckTime > 500) {
      health.status = 'degraded';
      health.warnings?.push('Session check slow');
    }

    // 全体的な健全性の判定
    const criticalCapabilities = [
      health.capabilities.sessionValidation,
      health.capabilities.userRetrieval
    ];
    
    if (criticalCapabilities.some(cap => !cap)) {
      health.status = 'unhealthy';
    } else if (health.warnings && health.warnings.length > 2) {
      health.status = 'degraded';
    }

  } catch (_error) {
    health.status = 'unhealthy';
    health.error = _error instanceof Error ? _error.message : 'Unknown auth error';
    
    return NextResponse.json(health, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  // ステータスコードの決定
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  // 警告がない場合は配列を削除
  if (health.warnings?.length === 0) {
    delete health.warnings;
  }

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': (Date.now() - startTime).toString(),
      'X-Auth-Status': health.status
    }
  });
}
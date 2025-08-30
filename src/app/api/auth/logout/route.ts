import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SessionManager } from '@/lib/security/session-manager';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // 1. 現在のセッション情報を取得（ログ用）
    const session = await SessionManager.verifySession(request);
    const userId = session?.userId;
    const email = session?.email;

    // 2. Supabase からログアウト
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Logout error', {
        requestId,
        userId,
        error: error.message,
      });
      
      // エラーがあってもセッションは破棄する
    }

    // 3. カスタムセッションを破棄
    await SessionManager.destroySession(request);

    // 4. 監査ログ
    logger.info('Logout successful', {
      requestId,
      userId,
      email,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // 5. 成功レスポンス
    const response = NextResponse.json({
      success: true,
      message: 'ログアウトしました',
      redirectTo: '/login',
    });

    // Cookieをクリア（追加の安全対策）
    response.cookies.delete('app-session');
    response.cookies.delete('app-refresh-token');
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');

    // セキュリティヘッダー
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Clear-Site-Data', '"cookies", "storage"');
    response.headers.set('X-Request-Id', requestId);

    return response;

  } catch (error) {
    logger.error('Logout processing error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // ログアウト処理のエラーでも成功として扱う
    // （ユーザーの体験を優先）
    const response = NextResponse.json({
      success: true,
      message: 'ログアウトしました',
      redirectTo: '/login',
    });

    // Cookieは必ずクリア
    response.cookies.delete('app-session');
    response.cookies.delete('app-refresh-token');
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');

    return response;
  }
}

// GETメソッドもサポート（一部のログアウトリンクのため）
export async function GET(request: NextRequest) {
  return POST(request);
}
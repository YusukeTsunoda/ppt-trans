import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { withRateLimit, createRateLimitResponse } from '@/lib/rate-limiter';

export async function middleware(request: NextRequest) {
  // APIルートのレート制限チェック
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const path = request.nextUrl.pathname;
    
    // エンドポイント別のレート制限
    let limiterName = 'api';
    let limit = 100;
    
    if (path.includes('/auth')) {
      limiterName = 'auth';
      limit = 10;
    } else if (path.includes('/translate')) {
      limiterName = 'translate';
      limit = 50;
    } else if (path.includes('/upload')) {
      limiterName = 'upload';
      limit = 20;
    }
    
    const rateLimitResult = await withRateLimit(request, limiterName, limit);
    if (rateLimitResult) {
      return createRateLimitResponse(rateLimitResult);
    }
  }
  
  // レスポンスを初期化
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Supabaseクライアントを作成（改善されたcookie処理）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // レスポンスにcookieを設定（重要：これが欠けていた）
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 現在のユーザー情報を取得
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // E2Eテスト時のデバッグ用ログ
  if (request.headers.get('X-E2E-Test') === 'true' && process.env.NODE_ENV === 'development') {
    const cookies = request.cookies.getAll();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    console.log('[E2E Debug] Middleware auth check:', {
      pathname: request.nextUrl.pathname,
      hasCookie: !!authCookie,
      cookieName: authCookie?.name,
      cookieValue: authCookie?.value ? `${authCookie.value.substring(0, 50)}...` : 'none',
      user: user ? { id: user.id, email: user.email } : null,
      error: authError?.message || null,
      allCookieNames: cookies.map(c => c.name)
    });
  }

  // 認証エラーは通常の動作なのでログは出力しない
  // デバッグが必要な場合のみ以下をアンコメント
  // if (authError && process.env.NODE_ENV === 'development') {
  //   console.debug('Auth check:', authError.message);
  // }

  // ルート定義
  const protectedPaths = ['/dashboard', '/upload', '/files', '/profile', '/admin'];
  const authPaths = ['/login', '/register'];

  const pathname = request.nextUrl.pathname;
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isAuthPath = authPaths.some(path => pathname.startsWith(path));

  // 未認証ユーザーが保護されたルートにアクセスしようとした場合
  if (isProtectedPath && !user) {
    const redirectUrl = new URL('/login', request.url);
    // パスとクエリパラメータを含めてcallbackUrlを設定
    const fullPath = pathname + request.nextUrl.search;
    redirectUrl.searchParams.set('callbackUrl', fullPath);
    return NextResponse.redirect(redirectUrl);
  }

  // 認証済みユーザーが認証ページにアクセスしようとした場合
  if (isAuthPath && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/test-auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
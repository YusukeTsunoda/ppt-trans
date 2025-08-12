import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequestWithAuth } from 'next-auth/middleware';
// レート制限はEdge Runtimeで使用できないため、APIルート内で実装
// XSSProtectionはEdge Runtimeで使用できないため、CSPは直接設定
// loggerはEdge Runtimeでの使用を避ける

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth?.token;
    const pathname = req.nextUrl.pathname;
    const response = NextResponse.next();
    
    try {
      // セキュリティヘッダーの設定
      setSecurityHeaders(response);
      
      // APIルートのセキュリティ処理（NextAuth関連のみ残存）
      if (pathname.startsWith('/api/')) {
        // レート制限はAPIルート内で個別に実装
        // Server Actionsは自動的にCSRF保護されるため、追加の実装は不要
        
        // API専用ヘッダー
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-API-Version', '1.0.0');
      }
      
      // Admin routes require admin role
      if (pathname.startsWith('/admin')) {
        if (!token || ((token as any).role !== 'ADMIN' && (token as any).role !== 'SUPER_ADMIN')) {
          return NextResponse.redirect(new URL('/login', req.url));
        }
      }
      
      return response;
    } catch (error) {
      console.error('Middleware security error', error);
      return response;
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Public routes - no authentication required
        if (
          pathname === '/login' ||
          pathname === '/register' ||
          pathname === '/test-login' ||
          pathname.startsWith('/api/auth')
          // APIエンドポイントは認証必須に変更（セキュリティ強化）
          // pathname.startsWith('/api/translate') - 削除
          // pathname.startsWith('/api/generate') - 削除
        ) {
          return true;
        }
        
        // All other routes require authentication
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

/**
 * セキュリティヘッダーを設定
 */
function setSecurityHeaders(response: NextResponse) {
  // Content Security Policy
  // CSPを直接設定（Edge Runtime対応）
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);
  
  // その他のセキュリティヘッダー
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
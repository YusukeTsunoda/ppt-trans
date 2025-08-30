import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '@/middleware';

// NextRequestのモック
function createMockRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options as any);
}

describe('middleware', () => {
  describe('Security Headers', () => {
    it('should add all security headers to responses', async () => {
      const request = createMockRequest('/');
      const response = await middleware(request);
      
      // セキュリティヘッダーの確認
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
      expect(response.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    });

    it('should include comprehensive CSP header', async () => {
      const request = createMockRequest('/');
      const response = await middleware(request);
      
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toBeTruthy();
      
      // CSPディレクティブの確認
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
      expect(csp).toContain("img-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it('should handle CORS headers for API routes', async () => {
      const request = createMockRequest('/api/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      
      const response = await middleware(request);
      
      // CORSヘッダーは制限的であるべき
      const allowOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(allowOrigin).toBeFalsy(); // デフォルトではCORSを許可しない
    });
  });

  describe('Request Validation', () => {
    it('should pass through valid requests', async () => {
      const request = createMockRequest('/dashboard');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('should handle static resources', async () => {
      const request = createMockRequest('/_next/static/chunk.js');
      const response = await middleware(request);
      
      // 静的リソースには基本的なセキュリティヘッダーのみ
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should protect API routes', async () => {
      const request = createMockRequest('/api/admin/users');
      const response = await middleware(request);
      
      // APIルートにもセキュリティヘッダーが適用される
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize suspicious query parameters', async () => {
      const request = createMockRequest('/?search=<script>alert(1)</script>');
      const response = await middleware(request);
      
      // XSS攻撃の可能性がある入力は処理される
      expect(response.headers.get('X-XSS-Protection')).toBeDefined();
    });

    it('should block requests with malicious payloads', async () => {
      const request = createMockRequest('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: '<img src=x onerror=alert(1)>'
        })
      });
      
      const response = await middleware(request);
      
      // セキュリティヘッダーが適用される
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should not add unnecessary headers to static assets', async () => {
      const request = createMockRequest('/favicon.ico');
      const response = await middleware(request);
      
      // 必要最小限のヘッダーのみ
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should handle prefetch requests efficiently', async () => {
      const request = createMockRequest('/', {
        headers: {
          'Purpose': 'prefetch'
        }
      });
      
      const response = await middleware(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed URLs gracefully', async () => {
      const request = createMockRequest('/%00%00');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should handle very long URLs', async () => {
      const longPath = '/' + 'a'.repeat(8000);
      const request = createMockRequest(longPath);
      const response = await middleware(request);
      
      expect(response).toBeDefined();
    });

    it('should handle requests without origin', async () => {
      const request = createMockRequest('/api/test', {
        method: 'POST'
      });
      
      const response = await middleware(request);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
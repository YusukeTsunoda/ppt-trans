import {
  SECURITY_HEADERS,
  RATE_LIMIT_CONFIGS,
  validateCSRFToken,
  applySecurityHeaders,
  validateRequest,
  checkRateLimit
} from '../src/middleware-security';
import { NextRequest, NextResponse } from 'next/server';

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({
      headers: {
        set: jest.fn()
      }
    }))
  }
}));

describe('middleware-security', () => {
  describe('SECURITY_HEADERS', () => {
    test('includes all required security headers', () => {
      expect(SECURITY_HEADERS).toHaveProperty('Content-Security-Policy');
      expect(SECURITY_HEADERS).toHaveProperty('X-Frame-Options', 'DENY');
      expect(SECURITY_HEADERS).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(SECURITY_HEADERS).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    test('includes HSTS header in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Re-import to get updated headers
      const { SECURITY_HEADERS: prodHeaders } = require('../src/middleware-security');
      
      expect(prodHeaders).toHaveProperty('Strict-Transport-Security');
      
      process.env.NODE_ENV = originalEnv;
    });

    test('excludes HSTS header in development', () => {
      expect(SECURITY_HEADERS).not.toHaveProperty('Strict-Transport-Security');
    });

    test('CSP allows necessary domains', () => {
      const csp = SECURITY_HEADERS['Content-Security-Policy'];
      expect(csp).toContain('https://*.supabase.co');
      expect(csp).toContain('https://api.anthropic.com');
      expect(csp).toContain('frame-ancestors \'none\'');
    });
  });

  describe('RATE_LIMIT_CONFIGS', () => {
    test('defines rate limits for different endpoints', () => {
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('api');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('auth');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('upload');
      expect(RATE_LIMIT_CONFIGS).toHaveProperty('translate');
    });

    test('auth endpoints have stricter limits', () => {
      expect(RATE_LIMIT_CONFIGS.auth.max).toBeLessThan(RATE_LIMIT_CONFIGS.api.max);
      expect(RATE_LIMIT_CONFIGS.auth.max).toBe(5);
    });

    test('all configs have required properties', () => {
      Object.values(RATE_LIMIT_CONFIGS).forEach(config => {
        expect(config).toHaveProperty('windowMs');
        expect(config).toHaveProperty('max');
        expect(config).toHaveProperty('standardHeaders', true);
        expect(config).toHaveProperty('legacyHeaders', false);
      });
    });
  });

  describe('validateCSRFToken', () => {
    let mockRequest: Partial<NextRequest>;

    beforeEach(() => {
      mockRequest = {
        headers: {
          get: jest.fn()
        } as any,
        cookies: {
          get: jest.fn()
        } as any
      };
    });

    test('returns true for matching CSRF tokens', () => {
      const token = 'test-csrf-token';
      (mockRequest.headers!.get as jest.Mock).mockReturnValue(token);
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: token });

      const result = validateCSRFToken(mockRequest as NextRequest);
      expect(result).toBe(true);
    });

    test('returns false when header token is missing', () => {
      (mockRequest.headers!.get as jest.Mock).mockReturnValue(null);
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'token' });

      const result = validateCSRFToken(mockRequest as NextRequest);
      expect(result).toBe(false);
    });

    test('returns false when cookie token is missing', () => {
      (mockRequest.headers!.get as jest.Mock).mockReturnValue('token');
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue(undefined);

      const result = validateCSRFToken(mockRequest as NextRequest);
      expect(result).toBe(false);
    });

    test('returns false for mismatched tokens', () => {
      (mockRequest.headers!.get as jest.Mock).mockReturnValue('header-token');
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'cookie-token' });

      const result = validateCSRFToken(mockRequest as NextRequest);
      expect(result).toBe(false);
    });

    test('uses timing-safe comparison', () => {
      // Test that function doesn't short-circuit on different lengths
      (mockRequest.headers!.get as jest.Mock).mockReturnValue('short');
      (mockRequest.cookies!.get as jest.Mock).mockReturnValue({ value: 'longer-token' });

      const result = validateCSRFToken(mockRequest as NextRequest);
      expect(result).toBe(false);
    });
  });

  describe('applySecurityHeaders', () => {
    test('applies all security headers to response', () => {
      const mockResponse = {
        headers: {
          set: jest.fn()
        }
      };

      const result = applySecurityHeaders(mockResponse as any);

      expect(result).toBe(mockResponse);
      expect(mockResponse.headers.set).toHaveBeenCalledTimes(Object.keys(SECURITY_HEADERS).length);
      
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        expect(mockResponse.headers.set).toHaveBeenCalledWith(key, value);
      });
    });
  });

  describe('validateRequest', () => {
    let mockRequest: Partial<NextRequest>;

    beforeEach(() => {
      mockRequest = {
        headers: {
          get: jest.fn()
        } as any,
        method: 'GET'
      };
    });

    test('returns valid for legitimate requests', () => {
      (mockRequest.headers!.get as jest.Mock).mockImplementation((header: string) => {
        switch (header) {
          case 'user-agent':
            return 'Mozilla/5.0 (compatible; Bot)';
          case 'referer':
            return null;
          default:
            return null;
        }
      });

      const result = validateRequest(mockRequest as NextRequest);
      expect(result.valid).toBe(true);
    });

    test('rejects requests with invalid user agent', () => {
      (mockRequest.headers!.get as jest.Mock).mockReturnValue('Bot'); // Too short

      const result = validateRequest(mockRequest as NextRequest);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid user agent');
    });

    test('rejects requests with missing user agent', () => {
      (mockRequest.headers!.get as jest.Mock).mockReturnValue(null);

      const result = validateRequest(mockRequest as NextRequest);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid user agent');
    });

    test('validates referer when present', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com';
      
      (mockRequest.headers!.get as jest.Mock).mockImplementation((header: string) => {
        switch (header) {
          case 'user-agent':
            return 'Mozilla/5.0 (compatible; Bot)';
          case 'referer':
            return 'https://evil.com/attack';
          default:
            return null;
        }
      });

      const result = validateRequest(mockRequest as NextRequest);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Invalid referer');

      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    test('requires content-type for POST requests', () => {
      mockRequest.method = 'POST';
      
      (mockRequest.headers!.get as jest.Mock).mockImplementation((header: string) => {
        switch (header) {
          case 'user-agent':
            return 'Mozilla/5.0 (compatible; Bot)';
          case 'content-type':
            return null; // Missing content-type
          default:
            return null;
        }
      });

      const result = validateRequest(mockRequest as NextRequest);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing content-type');
    });
  });

  describe('checkRateLimit', () => {
    const mockConfig = RATE_LIMIT_CONFIGS.api;

    beforeEach(() => {
      // Clear rate limit store between tests
      const { rateLimitStore } = require('../src/middleware-security');
      if (rateLimitStore && typeof rateLimitStore.clear === 'function') {
        rateLimitStore.clear();
      }
    });

    test('allows first request', () => {
      const result = checkRateLimit('127.0.0.1', '/api/test', mockConfig);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(mockConfig.max - 1);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    test('tracks subsequent requests', () => {
      const ip = '127.0.0.1';
      const endpoint = '/api/test';
      
      // First request
      const first = checkRateLimit(ip, endpoint, mockConfig);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(mockConfig.max - 1);
      
      // Second request
      const second = checkRateLimit(ip, endpoint, mockConfig);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(mockConfig.max - 2);
    });

    test('blocks requests exceeding limit', () => {
      const ip = '127.0.0.1';
      const endpoint = '/api/test';
      
      // Make max number of requests
      for (let i = 0; i < mockConfig.max; i++) {
        const result = checkRateLimit(ip, endpoint, mockConfig);
        expect(result.allowed).toBe(true);
      }
      
      // Next request should be blocked
      const blocked = checkRateLimit(ip, endpoint, mockConfig);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    test('resets after window expires', () => {
      const ip = '127.0.0.1';
      const endpoint = '/api/test';
      const shortConfig = { ...mockConfig, windowMs: 1 }; // 1ms window
      
      // Make request
      const first = checkRateLimit(ip, endpoint, shortConfig);
      expect(first.allowed).toBe(true);
      
      // Wait for window to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const second = checkRateLimit(ip, endpoint, shortConfig);
          expect(second.allowed).toBe(true);
          expect(second.remaining).toBe(shortConfig.max - 1);
          resolve(undefined);
        }, 2);
      });
    });

    test('handles different IPs independently', () => {
      const endpoint = '/api/test';
      
      const result1 = checkRateLimit('127.0.0.1', endpoint, mockConfig);
      const result2 = checkRateLimit('192.168.1.1', endpoint, mockConfig);
      
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.remaining).toBe(result2.remaining);
    });

    test('handles different endpoints independently', () => {
      const ip = '127.0.0.1';
      
      const result1 = checkRateLimit(ip, '/api/test1', mockConfig);
      const result2 = checkRateLimit(ip, '/api/test2', mockConfig);
      
      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result1.remaining).toBe(result2.remaining);
    });
  });
});
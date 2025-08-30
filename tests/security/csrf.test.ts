import { NextRequest, NextResponse } from 'next/server';
import { CSRFProtection } from '@/lib/security/csrf';

// Mock Next.js cookies
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(() => [])
  }))
}));

describe('CSRF Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CSRFProtection.generateToken', () => {
    it('should generate a token of correct length', () => {
      const token = CSRFProtection.generateToken();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = CSRFProtection.generateToken();
      const token2 = CSRFProtection.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('CSRFProtection.validateToken', () => {
    it('should skip validation for GET requests', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'GET'
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(true);
    });

    it('should skip validation for HEAD requests', async () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'HEAD'
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(true);
    });

    it('should skip validation for public paths', async () => {
      const request = new NextRequest('http://localhost/api/health', {
        method: 'POST'
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(true);
    });

    it('should fail validation when no token is present', async () => {
      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST'
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(false);
    });

    it('should fail validation when tokens do not match', async () => {
      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'wrong-token'
        }
      });
      
      // Mock cookie with different token
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn().mockReturnValue({ value: 'correct-token' })
        }
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(false);
    });

    it('should pass validation when tokens match', async () => {
      const validToken = 'valid-csrf-token-1234567890abcdef';
      
      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST',
        headers: {
          'x-csrf-token': validToken
        }
      });
      
      // Mock cookie with matching token
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn().mockReturnValue({ value: validToken })
        }
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(true);
    });

    it('should extract token from JSON body', async () => {
      const validToken = 'valid-csrf-token-from-body';
      
      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ _csrf: validToken, data: 'test' })
      });
      
      // Mock the clone method
      request.clone = jest.fn().mockReturnValue({
        json: jest.fn().mockResolvedValue({ _csrf: validToken })
      });
      
      // Mock cookie with matching token
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn().mockReturnValue({ value: validToken })
        }
      });
      
      const isValid = await CSRFProtection.validateToken(request);
      expect(isValid).toBe(true);
    });
  });

  describe('CSRFProtection.createErrorResponse', () => {
    it('should create a 403 error response', () => {
      const response = CSRFProtection.createErrorResponse();
      expect(response.status).toBe(403);
    });

    it('should include error message in response', async () => {
      const response = CSRFProtection.createErrorResponse();
      const body = await response.json();
      expect(body.error).toBe('CSRF token validation failed');
    });
  });

  describe('withCSRFProtection middleware', () => {
    it('should call handler when validation passes', async () => {
      const { withCSRFProtection } = await import('@/lib/security/csrf');
      
      const request = new NextRequest('http://localhost/api/test', {
        method: 'GET' // GET requests are allowed
      });
      
      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );
      
      const response = await withCSRFProtection(request, handler);
      
      expect(handler).toHaveBeenCalled();
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    it('should return error response when validation fails', async () => {
      const { withCSRFProtection } = await import('@/lib/security/csrf');
      
      const request = new NextRequest('http://localhost/api/protected', {
        method: 'POST' // POST requires CSRF token
      });
      
      const handler = jest.fn();
      
      const response = await withCSRFProtection(request, handler);
      
      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('CSRF token validation failed');
    });
  });

  describe('Secure comparison', () => {
    it('should correctly compare equal strings', () => {
      // Testing private method indirectly through validateToken
      const validToken = 'a'.repeat(64);
      
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': validToken
        }
      });
      
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn().mockReturnValue({ value: validToken })
        }
      });
      
      CSRFProtection.validateToken(request).then(isValid => {
        expect(isValid).toBe(true);
      });
    });

    it('should correctly identify different strings', () => {
      const request = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'a'.repeat(64)
        }
      });
      
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn().mockReturnValue({ value: 'b'.repeat(64) })
        }
      });
      
      CSRFProtection.validateToken(request).then(isValid => {
        expect(isValid).toBe(false);
      });
    });
  });
});
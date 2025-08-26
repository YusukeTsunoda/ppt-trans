import { GET } from '../../../../../src/app/api/auth/callback/route';
import { createClient } from '../../../../../src/lib/supabase/server';
import { NextRequest } from 'next/server';
import logger from '../../../../../src/lib/logger';

// Mock dependencies
jest.mock('../../../../../src/lib/supabase/server');
jest.mock('../../../../../src/lib/logger');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock NextResponse
const mockRedirect = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    redirect: mockRedirect
  }
}));

describe('/api/auth/callback', () => {
  let mockSupabaseClient: any;
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: jest.fn()
      }
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);

    mockRequest = {
      nextUrl: {
        searchParams: new URLSearchParams(),
        origin: 'http://localhost:3000'
      }
    };

    mockRedirect.mockImplementation((url) => ({
      status: 302,
      headers: { Location: url },
      redirect: url
    }));
  });

  test('successfully exchanges code for session and redirects to dashboard', async () => {
    // Setup URL with auth code
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123' }
        }
      },
      error: null
    });

    const response = await GET(mockRequest as NextRequest);

    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/dashboard');
    expect(response.status).toBe(302);
  });

  test('redirects to error page when no code is provided', async () => {
    const response = await GET(mockRequest as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/login?error=missing_code');
    expect(response.status).toBe(302);
  });

  test('redirects to error page when code exchange fails', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'invalid-code');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: { message: 'Invalid code' }
    });

    const response = await GET(mockRequest as NextRequest);

    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('invalid-code');
    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/login?error=auth_failed');
    expect(mockLogger.error).toHaveBeenCalledWith('Auth callback error:', { message: 'Invalid code' });
  });

  test('handles error_description in URL params', async () => {
    (mockRequest.nextUrl as any).searchParams.set('error', 'access_denied');
    (mockRequest.nextUrl as any).searchParams.set('error_description', 'User denied access');

    const response = await GET(mockRequest as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/login?error=access_denied');
    expect(mockLogger.error).toHaveBeenCalledWith('Auth callback error:', 'User denied access');
  });

  test('redirects to custom redirect URL if provided', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');
    (mockRequest.nextUrl as any).searchParams.set('redirect_to', '/profile');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123' }
        }
      },
      error: null
    });

    const response = await GET(mockRequest as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/profile');
  });

  test('prevents open redirect attacks', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');
    (mockRequest.nextUrl as any).searchParams.set('redirect_to', 'https://evil.com/dashboard');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123' }
        }
      },
      error: null
    });

    const response = await GET(mockRequest as NextRequest);

    // Should redirect to default dashboard instead of external URL
    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/dashboard');
  });

  test('handles exception during code exchange', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');

    mockSupabaseClient.auth.exchangeCodeForSession.mockRejectedValue(
      new Error('Network error')
    );

    const response = await GET(mockRequest as NextRequest);

    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/login?error=auth_failed');
    expect(mockLogger.error).toHaveBeenCalledWith('Auth callback error:', expect.any(Error));
  });

  test('sanitizes redirect_to parameter', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');
    (mockRequest.nextUrl as any).searchParams.set('redirect_to', '/profile?param=<script>alert("xss")</script>');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123' }
        }
      },
      error: null
    });

    const response = await GET(mockRequest as NextRequest);

    // Should still redirect to the path but with safe parameters
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('/profile'));
    expect(mockRedirect).not.toHaveBeenCalledWith(expect.stringContaining('<script>'));
  });

  test('handles state parameter verification', async () => {
    (mockRequest.nextUrl as any).searchParams.set('code', 'auth-code-123');
    (mockRequest.nextUrl as any).searchParams.set('state', 'expected-state');

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-123' }
        }
      },
      error: null
    });

    const response = await GET(mockRequest as NextRequest);

    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith('auth-code-123');
    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/dashboard');
  });
});
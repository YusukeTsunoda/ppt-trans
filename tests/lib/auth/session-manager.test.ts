import {
  getSessionInfo,
  autoRefreshSession,
  validateAndRefreshSession,
  signOutSession,
  getSessionMetadata,
  logSessionEvent,
  SessionStatus
} from '../../../src/lib/auth/session-manager';
import { getRequestScopedSupabase, getRequestScopedUser } from '../../../src/lib/auth/request-scoped-auth';
import logger from '../../../src/lib/logger';

// Mock dependencies
jest.mock('../../../src/lib/auth/request-scoped-auth');
jest.mock('../../../src/lib/logger');

const mockGetRequestScopedSupabase = getRequestScopedSupabase as jest.MockedFunction<typeof getRequestScopedSupabase>;
const mockGetRequestScopedUser = getRequestScopedUser as jest.MockedFunction<typeof getRequestScopedUser>;
const mockLogger = logger as jest.Mocked<typeof logger>;

// Mock React cache
jest.mock('react', () => ({
  cache: (fn: any) => fn
}));

describe('session-manager', () => {
  let mockSupabaseClient: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules(); // Reset module cache to clear React cache
    
    mockSupabaseClient = {
      auth: {
        getSession: jest.fn(),
        refreshSession: jest.fn(),
        signOut: jest.fn()
      },
      from: jest.fn(() => ({
        insert: jest.fn()
      }))
    };
    
    mockGetRequestScopedSupabase.mockResolvedValue(mockSupabaseClient);
  });

  describe('getSessionInfo', () => {
    test('returns valid session info for active session', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await getSessionInfo();

      expect(result.status).toBe('valid');
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.isNearExpiry).toBe(false);
    });

    test('returns invalid status when no session exists', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getSessionInfo();

      expect(result.status).toBe('invalid');
      expect(result.userId).toBeUndefined();
      expect(result.email).toBeUndefined();
    });

    test('returns expired status for expired session', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        expires_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await getSessionInfo();

      expect(result.status).toBe('expired');
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    test('detects near expiry sessions', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        expires_at: Math.floor(Date.now() / 1000) + 120 // 2 minutes from now
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await getSessionInfo();

      expect(result.status).toBe('valid');
      expect(result.isNearExpiry).toBe(true);
    });

    test('handles session error', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session error')
      });

      const result = await getSessionInfo();

      expect(result.status).toBe('invalid');
    });

    test('handles exception during session check', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(new Error('Network error'));

      const result = await getSessionInfo();

      expect(result.status).toBe('invalid');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get session info:', expect.any(Error));
    });
  });

  describe('autoRefreshSession', () => {
    test('refreshes expired session successfully', async () => {
      // Mock expired session info
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'expired',
          userId: 'user-123'
        })
      }));

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      const result = await autoRefreshSession();

      expect(result).toBe(true);
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
    });

    test('refreshes session near expiry', async () => {
      // Mock session near expiry
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          userId: 'user-123',
          isNearExpiry: true
        })
      }));

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
        error: null
      });

      const result = await autoRefreshSession();

      expect(result).toBe(true);
      expect(mockSupabaseClient.auth.refreshSession).toHaveBeenCalled();
    });

    test('does not refresh valid session', async () => {
      // Mock valid session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          userId: 'user-123',
          isNearExpiry: false
        })
      }));

      const result = await autoRefreshSession();

      expect(result).toBe(true);
      expect(mockSupabaseClient.auth.refreshSession).not.toHaveBeenCalled();
    });

    test('handles refresh failure', async () => {
      // Mock expired session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'expired',
          userId: 'user-123'
        })
      }));

      mockSupabaseClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed')
      });

      const result = await autoRefreshSession();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to refresh session:', expect.any(Error));
    });
  });

  describe('validateAndRefreshSession', () => {
    test('returns false for invalid session', async () => {
      // Mock invalid session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'invalid'
        })
      }));

      const result = await validateAndRefreshSession();

      expect(result).toBe(false);
    });

    test('returns true for valid session', async () => {
      // Mock valid session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          isNearExpiry: false
        })
      }));

      const result = await validateAndRefreshSession();

      expect(result).toBe(true);
    });
  });

  describe('signOutSession', () => {
    test('signs out successfully', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });

      await expect(signOutSession()).resolves.toBeUndefined();
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    test('throws error on sign out failure', async () => {
      const signOutError = new Error('Sign out failed');
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: signOutError });

      await expect(signOutSession()).rejects.toThrow('Sign out failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to sign out:', signOutError);
    });

    test('handles sign out exception', async () => {
      const exception = new Error('Network error');
      mockSupabaseClient.auth.signOut.mockRejectedValue(exception);

      await expect(signOutSession()).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to sign out:', exception);
    });
  });

  describe('getSessionMetadata', () => {
    test('returns metadata for authenticated user', async () => {
      const mockUser = { 
        id: 'user-123', 
        email: 'test@example.com',
        aud: 'authenticated',
        role: 'authenticated',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: {}
      } as any;
      
      // Mock session info and user
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          userId: 'user-123',
          email: 'test@example.com',
          expiresAt: new Date('2024-01-01T12:00:00Z'),
          isNearExpiry: false
        })
      }));
      
      mockGetRequestScopedUser.mockResolvedValue(mockUser);

      const result = await getSessionMetadata();

      expect(result.isAuthenticated).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.needsRefresh).toBe(false);
      expect(result.status).toBe('valid');
    });

    test('returns metadata for unauthenticated user', async () => {
      // Mock invalid session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'invalid'
        })
      }));
      
      mockGetRequestScopedUser.mockResolvedValue(null);

      const result = await getSessionMetadata();

      expect(result.isAuthenticated).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.status).toBe('invalid');
    });
  });

  describe('logSessionEvent', () => {
    test('logs session event successfully', async () => {
      // Mock session info
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          userId: 'user-123'
        })
      }));

      mockSupabaseClient.from().insert.mockResolvedValue({ error: null });

      await logSessionEvent('login', { ip: '127.0.0.1' });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('activity_logs');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          action: 'session_login',
          description: 'Session login event',
          metadata: expect.objectContaining({
            ip: '127.0.0.1',
            timestamp: expect.any(String),
            session_status: 'valid'
          })
        })
      );
    });

    test('logs anonymous session event', async () => {
      // Mock invalid session
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'invalid'
        })
      }));

      mockSupabaseClient.from().insert.mockResolvedValue({ error: null });

      await logSessionEvent('expire');

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'anonymous',
          action: 'session_expire'
        })
      );
    });

    test('handles logging error gracefully', async () => {
      // Mock session info
      jest.doMock('../../../src/lib/auth/session-manager', () => ({
        ...jest.requireActual('../../../src/lib/auth/session-manager'),
        getSessionInfo: jest.fn().mockResolvedValue({
          status: 'valid',
          userId: 'user-123'
        })
      }));

      mockSupabaseClient.from().insert.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(logSessionEvent('logout')).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to log session event logout:',
        expect.any(Error)
      );
    });
  });
});
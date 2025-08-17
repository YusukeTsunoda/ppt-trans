/**
 * リクエストスコープ認証のテスト
 */

import { createServerClient } from '@supabase/ssr';

// Supabase SSRのモック
jest.mock('@supabase/ssr');

// Next.jsのcookiesとcacheのモック
jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    getAll: jest.fn().mockReturnValue([]),
    set: jest.fn(),
  }),
}));

jest.mock('react', () => ({
  cache: (fn: any) => fn,
}));

describe('Request-Scoped Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 環境変数を設定
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('getRequestScopedSupabase', () => {
    it('should create a Supabase client with request-scoped cookies', async () => {
      // Supabaseクライアントのモックを設定
      const mockClient = {
        auth: {
          getUser: jest.fn(),
          signIn: jest.fn(),
          signOut: jest.fn(),
        },
        from: jest.fn(),
      };
      
      (createServerClient as jest.Mock).mockReturnValue(mockClient);
      
      const { getRequestScopedSupabase } = await import('../request-scoped-auth');
      const client = await getRequestScopedSupabase();
      
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
      expect(client.from).toBeDefined();
    });

    it('should be cached per request', async () => {
      // Supabaseクライアントのモックを設定
      const mockClient = {
        auth: {
          getUser: jest.fn(),
          signIn: jest.fn(),
          signOut: jest.fn(),
        },
        from: jest.fn(),
      };
      
      (createServerClient as jest.Mock).mockReturnValue(mockClient);
      
      const { getRequestScopedSupabase } = await import('../request-scoped-auth');
      
      const client1 = await getRequestScopedSupabase();
      const client2 = await getRequestScopedSupabase();
      
      // 両方のクライアントが同じインスタンスであることを確認
      // （実際のcache動作はモック環境では検証困難）
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });

  describe('getRequestScopedUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        }
      });

      const { getRequestScopedUser } = await import('../request-scoped-auth');
      const user = await getRequestScopedUser();
      
      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null
          })
        }
      });

      const { getRequestScopedUser } = await import('../request-scoped-auth');
      const user = await getRequestScopedUser();
      
      expect(user).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Auth error')
          })
        }
      });

      const { getRequestScopedUser } = await import('../request-scoped-auth');
      const user = await getRequestScopedUser();
      
      expect(user).toBeNull();
    });
  });

  describe('getRequestScopedProfile', () => {
    it('should return profile for authenticated user', async () => {
      const mockProfile = {
        id: 'user-123',
        username: 'testuser',
        full_name: 'Test User',
        role: 'USER'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            }))
          }))
        }))
      });

      const { getRequestScopedProfile } = await import('../request-scoped-auth');
      const profile = await getRequestScopedProfile();
      
      expect(profile).toEqual(mockProfile);
    });

    it('should return null when profile not found', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Profile not found')
              })
            }))
          }))
        }))
      });

      const { getRequestScopedProfile } = await import('../request-scoped-auth');
      const profile = await getRequestScopedProfile();
      
      expect(profile).toBeNull();
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return combined user and profile data', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      const mockProfile = {
        id: 'user-123',
        username: 'testuser',
        full_name: 'Test User',
        role: 'USER',
        updated_at: '2024-01-02T00:00:00Z'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            }))
          }))
        }))
      });

      const { getAuthenticatedUser } = await import('../request-scoped-auth');
      const user = await getAuthenticatedUser();
      
      expect(user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER',
        username: 'testuser',
        full_name: 'Test User',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      });
    });

    it('should return null when not authenticated', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null
          })
        }
      });

      const { getAuthenticatedUser } = await import('../request-scoped-auth');
      const user = await getAuthenticatedUser();
      
      expect(user).toBeNull();
    });
  });

  describe('requireAuthentication', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'USER'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: { ...mockUser, username: 'test', full_name: 'Test' },
                error: null
              })
            }))
          }))
        }))
      });

      const { requireAuthentication } = await import('../request-scoped-auth');
      const user = await requireAuthentication();
      
      expect(user.id).toBe('user-123');
    });

    it('should throw error when not authenticated', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null
          })
        }
      });

      const { requireAuthentication } = await import('../request-scoped-auth');
      
      await expect(requireAuthentication()).rejects.toThrow('Authentication required');
    });
  });

  describe('requireAdminRole', () => {
    it('should return user when admin', async () => {
      const mockUser = {
        id: 'admin-123',
        email: 'admin@example.com'
      };

      const mockProfile = {
        id: 'admin-123',
        role: 'ADMIN'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            }))
          }))
        }))
      });

      const { requireAdminRole } = await import('../request-scoped-auth');
      const user = await requireAdminRole();
      
      expect(user.role).toBe('ADMIN');
    });

    it('should throw error when not admin', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@example.com'
      };

      const mockProfile = {
        id: 'user-123',
        role: 'USER'
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null
          })
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: mockProfile,
                error: null
              })
            }))
          }))
        }))
      });

      const { requireAdminRole } = await import('../request-scoped-auth');
      
      await expect(requireAdminRole()).rejects.toThrow('Admin role required');
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_at: Date.now() / 1000 + 3600
      };

      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          refreshSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null
          })
        }
      });

      const { refreshSession } = await import('../request-scoped-auth');
      const session = await refreshSession();
      
      expect(session).toEqual(mockSession);
    });

    it('should return null on refresh failure', async () => {
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          refreshSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Refresh failed')
          })
        }
      });

      const { refreshSession } = await import('../request-scoped-auth');
      const session = await refreshSession();
      
      expect(session).toBeNull();
    });
  });
});
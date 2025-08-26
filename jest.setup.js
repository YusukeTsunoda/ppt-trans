// Jest setup file for test environment configuration

// Add custom matchers from jest-dom
require('@testing-library/jest-dom');

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.USE_REQUEST_SCOPED_AUTH = 'true';
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_TEST_MODE = 'true';
process.env.TEST_USER_EMAIL = 'test@example.com';
process.env.TEST_USER_PASSWORD = 'password123';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret-key';
process.env.ANTHROPIC_API_KEY = 'test-api-key';

// Mock Next.js modules
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => Promise.resolve({
    getAll: jest.fn(() => []),
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(() => false)
  })),
  headers: jest.fn(() => ({
    get: jest.fn(),
    forEach: jest.fn(),
    entries: jest.fn(() => [])
  }))
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
    has: jest.fn(),
  }),
  usePathname: () => '/test',
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock React cache
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn) => fn
}));

// Mock global fetch for API tests
global.fetch = jest.fn((url, options) => {
  return Promise.resolve({
    status: 200,
    ok: true,
    json: async () => ({}),
    headers: new Headers(),
  });
});

// Global test utilities
global.mockSupabaseClient = () => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({ 
      data: { user: null }, 
      error: null 
    }),
    getSession: jest.fn().mockResolvedValue({ 
      data: { session: null }, 
      error: null 
    }),
    refreshSession: jest.fn().mockResolvedValue({ 
      data: { session: null }, 
      error: null 
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      })),
      limit: jest.fn().mockResolvedValue({ data: [], error: null })
    })),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockResolvedValue({ data: null, error: null }),
    delete: jest.fn().mockResolvedValue({ data: null, error: null }),
  }))
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
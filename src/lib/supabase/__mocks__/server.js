// Supabase Server Client Mock
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

const mockSession = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'mock-refresh-token',
  user: mockUser,
};

const authMock = {
  getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
  getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession }, error: null })),
  signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null })),
  signOut: jest.fn(() => Promise.resolve({ error: null })),
  signUp: jest.fn(() => Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null })),
};

const fromMock = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
}));

const storageMock = {
  from: jest.fn(() => ({
    upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
    download: jest.fn(() => Promise.resolve({ data: new Blob(['test']), error: null })),
    remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.url' } })),
  })),
};

const supabaseClient = {
  auth: authMock,
  from: fromMock,
  storage: storageMock,
};

export const createClient = jest.fn(() => Promise.resolve(supabaseClient));
export const createServerClient = jest.fn(() => Promise.resolve(supabaseClient));
export const createBrowserClient = jest.fn(() => supabaseClient);
export default { createClient, createServerClient, createBrowserClient };
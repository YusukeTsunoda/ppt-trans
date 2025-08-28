// Supabase JS Client Mock
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
  onAuthStateChange: jest.fn((callback) => {
    callback('SIGNED_IN', mockSession);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
  resetPasswordForEmail: jest.fn(() => Promise.resolve({ data: {}, error: null })),
};

const fromMock = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  single: jest.fn(() => Promise.resolve({ data: {}, error: null })),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  then: jest.fn((resolve) => resolve({ data: [], error: null })),
}));

const storageMock = {
  from: jest.fn(() => ({
    upload: jest.fn(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
    download: jest.fn(() => Promise.resolve({ data: new Blob(['test']), error: null })),
    remove: jest.fn(() => Promise.resolve({ data: {}, error: null })),
    getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://test.url' } })),
    list: jest.fn(() => Promise.resolve({ data: [], error: null })),
  })),
};

const supabaseClient = {
  auth: authMock,
  from: fromMock,
  storage: storageMock,
  rpc: jest.fn(() => Promise.resolve({ data: {}, error: null })),
};

export const createClient = jest.fn(() => supabaseClient);
export default { createClient };
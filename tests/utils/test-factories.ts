/**
 * Factory functions for creating test data
 */

import { FileRecord } from '@/lib/data/files';

export const createMockUser = (overrides = {}) => ({
  id: 'user-test-id',
  email: 'test@example.com',
  role: 'user',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockFile = (overrides = {}): FileRecord => ({
  id: 'file-test-id',
  user_id: 'user-test-id',
  filename: 'test-presentation.pptx',
  original_name: 'My Presentation.pptx',
  file_size: 1024000,
  mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  file_path: 'uploads/user-test-id/test-presentation.pptx',
  status: 'uploaded',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  source_lang: 'en',
  target_lang: 'ja',
  translation_status: null,
  translation_progress: 0,
  translated_file_path: null,
  error_message: null,
  ...overrides,
});

export const createMockTranslation = (overrides = {}) => ({
  id: 'translation-test-id',
  file_id: 'file-test-id',
  status: 'pending',
  progress: 0,
  slide_count: 10,
  translated_slide_count: 0,
  source_language: 'en',
  target_language: 'ja',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockFormData = (file?: File) => {
  const formData = new FormData();
  const defaultFile = file || new File(
    ['test content'],
    'test.pptx',
    { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
  );
  formData.append('file', defaultFile);
  return formData;
};

export const createMockSupabaseClient = (overrides = {}) => ({
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: { user: createMockUser() },
      error: null,
    }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPasswordForEmail: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        limit: jest.fn(),
      })),
      order: jest.fn(() => ({
        limit: jest.fn(),
      })),
    })),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      remove: jest.fn(),
      createSignedUrl: jest.fn(),
      getPublicUrl: jest.fn(),
    })),
  },
  ...overrides,
});

export const createMockResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'OK',
  headers: new Headers(),
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  blob: jest.fn().mockResolvedValue(new Blob()),
});

export const createMockRouter = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/',
  query: {},
});

export const createMockSearchParams = (params = {}) => ({
  get: jest.fn((key) => params[key] || null),
  has: jest.fn((key) => key in params),
  getAll: jest.fn((key) => params[key] ? [params[key]] : []),
  entries: jest.fn(() => Object.entries(params)),
  keys: jest.fn(() => Object.keys(params)),
  values: jest.fn(() => Object.values(params)),
  toString: jest.fn(() => new URLSearchParams(params).toString()),
});
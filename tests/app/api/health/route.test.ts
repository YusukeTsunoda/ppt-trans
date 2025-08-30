import { GET } from '../../../../src/app/api/health/route';
import { createClient } from '@supabase/supabase-js';
import logger from '../../../../src/lib/logger';

// Mock dependencies
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

jest.mock('../../../../src/lib/logger', () => ({
  error: jest.fn()
}));

// Mock NextResponse
const mockJson = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: {
    json: mockJson
  }
}));

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

describe('/api/health', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Mock NextResponse.json to return a proper NextResponse-like object
    mockJson.mockImplementation((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
      headers: new Headers(),
      ok: (options?.status || 200) < 400,
      redirected: false,
      statusText: options?.status === 503 ? 'Service Unavailable' : 'OK',
      type: 'basic' as ResponseType,
      url: '',
      clone: jest.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      text: jest.fn()
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns healthy status when all checks pass', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ 
            data: { id: 1, status: 'ok' }, 
            error: null 
          })
        })
      })
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.status).toBe(200);
    // Access the json data correctly
    const data = await response.json();
    expect(data).toMatchObject({
      timestamp: expect.any(String),
      environment: {
        hasSupabaseUrl: true,
        hasSupabaseKey: true,
        nodeEnv: expect.any(String)
      },
      database: {
        connected: true,
        testData: { id: 1, status: 'ok' }
      }
    });
  });

  test('returns unhealthy status when database connection fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Connection failed' } 
          })
        })
      })
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data).toMatchObject({
      environment: expect.any(Object),
      database: {
        connected: false,
        error: expect.any(String)
      }
    });
  });

  test('handles missing environment variables', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.environment).toBeDefined();
    expect(data.database.connected).toBe(false);
    expect(data.database.error).toBe('Database check failed');
  });

  test('logs errors when database check fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const mockError = new Error('Database connection error');
    const mockSupabaseClient = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(mockError)
        })
      })
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data).toMatchObject({
      database: {
        connected: false,
        error: expect.any(String)
      }
    });

    expect(logger.error).toHaveBeenCalledWith('Health check database error:', mockError);
  });

  test('handles createClient throwing an error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const mockError = new Error('Failed to create client');
    mockCreateClient.mockImplementation(() => {
      throw mockError;
    });

    const response = await GET();

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data).toMatchObject({
      database: {
        connected: false,
        error: expect.any(String)
      }
    });

    expect(logger.error).toHaveBeenCalledWith('Health check database error:', mockError);
  });
});
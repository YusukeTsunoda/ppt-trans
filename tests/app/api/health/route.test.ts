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
    mockJson.mockImplementation((data, options) => ({
      json: () => Promise.resolve(data),
      status: options?.status || 200,
      data
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('returns healthy status when database connection succeeds', async () => {
    // Setup environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    // Mock successful Supabase client
    const mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 1, status: 'ok' },
              error: null
            }))
          }))
        }))
      }))
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
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
    // Setup environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    // Mock failed Supabase client
    const mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Connection failed' }
            }))
          }))
        }))
      }))
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.data.database).toEqual({
      connected: false,
      error: 'Connection failed'
    });
  });

  test('handles missing environment variables', async () => {
    // Clear environment variables
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.data.environment).toEqual({
      hasSupabaseUrl: false,
      hasSupabaseKey: false,
      nodeEnv: expect.any(String)
    });
    expect(response.data.database).toEqual({
      connected: false,
      error: 'Missing Supabase credentials'
    });
    expect(logger.error).toHaveBeenCalledWith('Missing Supabase environment variables');
  });

  test('handles Supabase client creation error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    mockCreateClient.mockImplementation(() => {
      throw new Error('Client creation failed');
    });

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.data.database).toEqual({
      connected: false,
      error: 'Client creation failed'
    });
  });

  test('includes timestamp in response', async () => {
    const fixedDate = new Date('2023-01-01T12:00:00.000Z');
    jest.spyOn(global, 'Date').mockImplementation(() => fixedDate as any);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: { id: 1 },
              error: null
            }))
          }))
        }))
      }))
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient as any);

    const response = await GET();

    expect(response.data.timestamp).toBe('2023-01-01T12:00:00.000Z');

    jest.restoreAllMocks();
  });
});
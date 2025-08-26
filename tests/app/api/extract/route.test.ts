import { POST } from '../../../../src/app/api/extract/route';
import { createClient } from '../../../../src/lib/supabase/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import logger from '../../../../src/lib/logger';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('../../../../src/lib/supabase/server');
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('../../../../src/lib/logger');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('/api/extract', () => {
  let mockSupabaseClient: any;
  let mockRequest: Partial<NextRequest>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            })),
            single: jest.fn()
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn()
        })),
        upsert: jest.fn()
      })),
      storage: {
        from: jest.fn(() => ({
          download: jest.fn()
        }))
      }
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);

    // Mock request
    mockRequest = {
      json: jest.fn()
    };
  });

  test('returns error when fileId or filePath is missing', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({});

    const response = await POST(mockRequest as NextRequest);
    const responseData = await response.json();

    expect(response.status).toBe(400);
    expect(responseData).toEqual({
      success: false,
      error: 'ファイル情報が不足しています'
    });
  });

  test('returns error when user is not authenticated', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated')
    });

    const response = await POST(mockRequest as NextRequest);
    const responseData = await response.json();

    expect(response.status).toBe(401);
    expect(responseData).toEqual({
      success: false,
      error: '認証が必要です'
    });
  });

  test('returns error when file is not found', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: null,
      error: new Error('File not found')
    });

    const response = await POST(mockRequest as NextRequest);
    const responseData = await response.json();

    expect(response.status).toBe(404);
    expect(responseData).toEqual({
      success: false,
      error: 'ファイルが見つかりません'
    });
  });

  test('returns error when file download fails', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: { id: 'test-file-id', user_id: 'user-123' },
      error: null
    });

    mockSupabaseClient.storage.from().download.mockResolvedValue({
      data: null,
      error: new Error('Download failed')
    });

    const response = await POST(mockRequest as NextRequest);
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData).toEqual({
      success: false,
      error: 'ファイルのダウンロードに失敗しました'
    });
  });

  test('successfully processes extraction when python script succeeds', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: { id: 'test-file-id', user_id: 'user-123' },
      error: null
    });

    // Mock file blob
    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    };
    mockSupabaseClient.storage.from().download.mockResolvedValue({
      data: mockBlob,
      error: null
    });

    // Mock file operations
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('Not found')); // No venv
    mockFs.unlink.mockResolvedValue(undefined);

    // Mock python process
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    // Mock database update operations
    mockSupabaseClient.from().update().eq.mockResolvedValue({ error: null });
    mockSupabaseClient.from().upsert.mockResolvedValue({ error: null });

    const responsePromise = POST(mockRequest as NextRequest);

    // Simulate successful python script execution
    const mockResult = {
      success: true,
      slides: [
        {
          slide_number: 1,
          texts: ['Hello', 'World']
        }
      ]
    };

    // Trigger stdout data
    const onData = (mockProcess.stdout.on as jest.Mock).mock.calls.find(
      call => call[0] === 'data'
    )[1];
    onData(JSON.stringify(mockResult));

    // Trigger close with success code
    const onClose = (mockProcess.on as jest.Mock).mock.calls.find(
      call => call[0] === 'close'
    )[1];
    await onClose(0);

    const response = await responsePromise;
    const responseData = await response.json();

    expect(response.status).toBe(200);
    expect(responseData).toEqual({
      success: true,
      extractedData: mockResult,
      message: 'テキスト抽出が完了しました'
    });
  });

  test('handles python script timeout', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: { id: 'test-file-id', user_id: 'user-123' },
      error: null
    });

    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    };
    mockSupabaseClient.storage.from().download.mockResolvedValue({
      data: mockBlob,
      error: null
    });

    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('Not found'));
    mockFs.unlink.mockResolvedValue(undefined);

    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    // Mock timeout behavior
    jest.useFakeTimers();
    
    const responsePromise = POST(mockRequest as NextRequest);
    
    // Fast-forward time to trigger timeout
    jest.advanceTimersByTime(30000);

    // Trigger close after timeout
    const onClose = (mockProcess.on as jest.Mock).mock.calls.find(
      call => call[0] === 'close'
    )[1];
    await onClose(1);

    const response = await responsePromise;
    const responseData = await response.json();

    expect(response.status).toBe(504);
    expect(responseData.error).toBe('テキスト抽出がタイムアウトしました');
    expect(mockProcess.kill).toHaveBeenCalled();

    jest.useRealTimers();
  });

  test('handles python script execution error', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: { id: 'test-file-id', user_id: 'user-123' },
      error: null
    });

    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    };
    mockSupabaseClient.storage.from().download.mockResolvedValue({
      data: mockBlob,
      error: null
    });

    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('Not found'));
    mockFs.unlink.mockResolvedValue(undefined);

    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const responsePromise = POST(mockRequest as NextRequest);

    // Simulate python script error
    const onStderrData = (mockProcess.stderr.on as jest.Mock).mock.calls.find(
      call => call[0] === 'data'
    )[1];
    onStderrData('Python error occurred');

    // Trigger close with error code
    const onClose = (mockProcess.on as jest.Mock).mock.calls.find(
      call => call[0] === 'close'
    )[1];
    await onClose(1);

    const response = await responsePromise;
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('テキスト抽出に失敗しました');
  });

  test('handles JSON parse error', async () => {
    (mockRequest.json as jest.Mock).mockResolvedValue({
      fileId: 'test-file-id',
      filePath: 'test-path.pptx'
    });

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    mockSupabaseClient.from().select().eq().eq().single.mockResolvedValue({
      data: { id: 'test-file-id', user_id: 'user-123' },
      error: null
    });

    const mockBlob = {
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    };
    mockSupabaseClient.storage.from().download.mockResolvedValue({
      data: mockBlob,
      error: null
    });

    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('Not found'));
    mockFs.unlink.mockResolvedValue(undefined);

    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn()
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const responsePromise = POST(mockRequest as NextRequest);

    // Trigger stdout with invalid JSON
    const onData = (mockProcess.stdout.on as jest.Mock).mock.calls.find(
      call => call[0] === 'data'
    )[1];
    onData('Invalid JSON');

    // Trigger close with success code
    const onClose = (mockProcess.on as jest.Mock).mock.calls.find(
      call => call[0] === 'close'
    )[1];
    await onClose(0);

    const response = await responsePromise;
    const responseData = await response.json();

    expect(response.status).toBe(500);
    expect(responseData.error).toBe('結果の解析に失敗しました');
  });
});
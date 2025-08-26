import { getUserFiles, FileRecord } from '../../../src/lib/data/files';
import { createClient } from '../../../src/lib/supabase/server';
import logger from '../../../src/lib/logger';

// Mock dependencies
jest.mock('../../../src/lib/supabase/server');
jest.mock('../../../src/lib/logger');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('files data layer', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      auth: {
        getUser: jest.fn()
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn()
          }))
        }))
      }))
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
  });

  describe('getUserFiles', () => {
    test('returns user files when user is authenticated', async () => {
      const mockUser = { id: 'user-123' };
      const mockFiles: FileRecord[] = [
        {
          id: 'file-1',
          user_id: 'user-123',
          filename: 'presentation1.pptx',
          original_filename: 'My Presentation.pptx',
          file_size: 2048000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-1.pptx',
          status: 'completed',
          translation_result: {
            translated_path: 'translations/file-1-translated.pptx',
            slide_count: 10
          },
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:30:00Z'
        },
        {
          id: 'file-2',
          user_id: 'user-123',
          filename: 'presentation2.pptx',
          original_filename: 'Another Presentation.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-2.pptx',
          status: 'processing',
          created_at: '2023-01-01T11:00:00Z',
          updated_at: '2023-01-01T11:00:00Z'
        }
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await getUserFiles();

      expect(result).toEqual(mockFiles);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('files');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*');
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalledWith(
        'created_at',
        { ascending: false }
      );
    });

    test('returns empty array when user is not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      });

      const result = await getUserFiles();

      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('returns empty array when user is null', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await getUserFiles();

      expect(result).toEqual([]);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    test('handles database query error', async () => {
      const mockUser = { id: 'user-123' };
      const dbError = new Error('Database connection failed');

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: dbError
      });

      const result = await getUserFiles();

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching files:', dbError);
    });

    test('handles null data from database', async () => {
      const mockUser = { id: 'user-123' };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await getUserFiles();

      expect(result).toEqual([]);
    });

    test('returns files ordered by creation date descending', async () => {
      const mockUser = { id: 'user-123' };
      const mockFiles: FileRecord[] = [
        {
          id: 'file-2',
          user_id: 'user-123',
          filename: 'newer.pptx',
          original_filename: 'newer.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-2.pptx',
          status: 'completed',
          created_at: '2023-01-02T10:00:00Z',
          updated_at: '2023-01-02T10:00:00Z'
        },
        {
          id: 'file-1',
          user_id: 'user-123',
          filename: 'older.pptx',
          original_filename: 'older.pptx',
          file_size: 2048000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-1.pptx',
          status: 'completed',
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        }
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await getUserFiles();

      expect(result[0].created_at).toBe('2023-01-02T10:00:00Z'); // Newer first
      expect(result[1].created_at).toBe('2023-01-01T10:00:00Z'); // Older second
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalledWith(
        'created_at',
        { ascending: false }
      );
    });

    test('handles files with different statuses', async () => {
      const mockUser = { id: 'user-123' };
      const mockFiles: FileRecord[] = [
        {
          id: 'file-1',
          user_id: 'user-123',
          filename: 'uploaded.pptx',
          original_filename: 'uploaded.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-1.pptx',
          status: 'uploaded',
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        },
        {
          id: 'file-2',
          user_id: 'user-123',
          filename: 'processing.pptx',
          original_filename: 'processing.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-2.pptx',
          status: 'processing',
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        },
        {
          id: 'file-3',
          user_id: 'user-123',
          filename: 'failed.pptx',
          original_filename: 'failed.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-3.pptx',
          status: 'failed',
          translation_result: {
            error: 'Processing failed'
          },
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        }
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await getUserFiles();

      expect(result).toHaveLength(3);
      expect(result.find(f => f.id === 'file-1')?.status).toBe('uploaded');
      expect(result.find(f => f.id === 'file-2')?.status).toBe('processing');
      expect(result.find(f => f.id === 'file-3')?.status).toBe('failed');
      expect(result.find(f => f.id === 'file-3')?.translation_result?.error).toBe('Processing failed');
    });

    test('handles files with optional translation_result', async () => {
      const mockUser = { id: 'user-123' };
      const mockFiles: FileRecord[] = [
        {
          id: 'file-1',
          user_id: 'user-123',
          filename: 'no-result.pptx',
          original_filename: 'no-result.pptx',
          file_size: 1024000,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          storage_path: 'uploads/file-1.pptx',
          status: 'uploaded',
          created_at: '2023-01-01T10:00:00Z',
          updated_at: '2023-01-01T10:00:00Z'
        }
      ];

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await getUserFiles();

      expect(result).toHaveLength(1);
      expect(result[0].translation_result).toBeUndefined();
    });
  });
});
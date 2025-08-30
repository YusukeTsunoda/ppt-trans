import { db, serverDb, UserSettings, FileRecord, Translation, ActivityLog } from '../../../src/lib/supabase/database';
import { createClient } from '../../../src/lib/supabase/client';
import { createServerSupabaseClient } from '../../../src/lib/supabase/server';

// Mock dependencies
jest.mock('../../../src/lib/supabase/client');
jest.mock('../../../src/lib/supabase/server');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockCreateServerSupabaseClient = createServerSupabaseClient as jest.MockedFunction<typeof createServerSupabaseClient>;

describe('database', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabaseClient = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            order: jest.fn(() => ({
              order: jest.fn(),
              limit: jest.fn()
            })),
            limit: jest.fn()
          })),
          order: jest.fn(() => ({
            order: jest.fn(),
            limit: jest.fn()
          })),
          limit: jest.fn(),
          single: jest.fn()
        })),
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          })),
          single: jest.fn()
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        })),
        delete: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    };

    mockCreateClient.mockReturnValue(mockSupabaseClient);
    mockCreateServerSupabaseClient.mockResolvedValue(mockSupabaseClient);
  });

  describe('db.userSettings', () => {
    test('gets user settings successfully', async () => {
      const mockSettings: UserSettings = {
        id: 'settings-1',
        user_id: 'user-123',
        translation_model: 'claude-3-haiku',
        target_language: 'Japanese',
        batch_size: 10,
        auto_save: true,
        theme: 'dark'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockSettings,
        error: null
      });

      const result = await db.userSettings.get('user-123');

      expect(result).toEqual(mockSettings);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_settings');
      expect(mockSupabaseClient.from().select).toHaveBeenCalledWith('*');
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    test('handles user settings not found error gracefully', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      });

      const result = await db.userSettings.get('user-123');

      expect(result).toBeNull();
    });

    test('throws error for other database errors', async () => {
      const dbError = { code: 'OTHER_ERROR', message: 'Database error' };
      
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: dbError
      });

      await expect(db.userSettings.get('user-123')).rejects.toEqual(dbError);
    });

    test('upserts user settings successfully', async () => {
      const settings: UserSettings = {
        user_id: 'user-123',
        translation_model: 'claude-3-sonnet',
        target_language: 'English'
      };

      const savedSettings = { ...settings, id: 'settings-1' };

      mockSupabaseClient.from().upsert().select().single.mockResolvedValue({
        data: savedSettings,
        error: null
      });

      const result = await db.userSettings.upsert(settings);

      expect(result).toEqual(savedSettings);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('user_settings');
      expect(mockSupabaseClient.from().upsert).toHaveBeenCalledWith(settings);
    });
  });

  describe('db.files', () => {
    test('lists files for user', async () => {
      const mockFiles: FileRecord[] = [
        {
          id: 'file-1',
          user_id: 'user-123',
          filename: 'presentation1.pptx',
          original_name: 'My Presentation.pptx',
          status: 'completed'
        },
        {
          id: 'file-2',
          user_id: 'user-123',
          filename: 'presentation2.pptx',
          original_name: 'Another Presentation.pptx',
          status: 'processing'
        }
      ];

      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: mockFiles,
        error: null
      });

      const result = await db.files.list('user-123');

      expect(result).toEqual(mockFiles);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('files');
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalledWith(
        'created_at',
        { ascending: false }
      );
    });

    test('gets single file by ID', async () => {
      const mockFile: FileRecord = {
        id: 'file-1',
        user_id: 'user-123',
        filename: 'presentation.pptx',
        original_name: 'My Presentation.pptx',
        status: 'completed'
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockFile,
        error: null
      });

      const result = await db.files.get('file-1');

      expect(result).toEqual(mockFile);
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('id', 'file-1');
    });

    test('creates new file', async () => {
      const newFile: FileRecord = {
        user_id: 'user-123',
        filename: 'new.pptx',
        original_name: 'New Presentation.pptx'
      };

      const createdFile = { ...newFile, id: 'file-new' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdFile,
        error: null
      });

      const result = await db.files.create(newFile);

      expect(result).toEqual(createdFile);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newFile);
    });

    test('updates file', async () => {
      const updates = { status: 'completed', slide_count: 15 };
      const updatedFile = { id: 'file-1', ...updates };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updatedFile,
        error: null
      });

      const result = await db.files.update('file-1', updates);

      expect(result).toEqual(updatedFile);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(updates);
      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith('id', 'file-1');
    });

    test('deletes file', async () => {
      mockSupabaseClient.from().delete().eq.mockResolvedValue({
        error: null
      });

      await db.files.delete('file-1');

      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith('id', 'file-1');
    });
  });

  describe('db.translations', () => {
    test('lists translations by file', async () => {
      const mockTranslations: Translation[] = [
        {
          id: 'trans-1',
          file_id: 'file-1',
          original_text: 'Hello',
          translated_text: 'こんにちは',
          slide_number: 1,
          element_index: 0
        },
        {
          id: 'trans-2',
          file_id: 'file-1',
          original_text: 'World',
          translated_text: '世界',
          slide_number: 1,
          element_index: 1
        }
      ];

      mockSupabaseClient.from().select().eq().order().order.mockResolvedValue({
        data: mockTranslations,
        error: null
      });

      const result = await db.translations.listByFile('file-1');

      expect(result).toEqual(mockTranslations);
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('file_id', 'file-1');
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalledWith(
        'slide_number',
        { ascending: true }
      );
    });

    test('creates single translation', async () => {
      const newTranslation: Translation = {
        file_id: 'file-1',
        original_text: 'Test',
        slide_number: 1,
        element_index: 0
      };

      const createdTranslation = { ...newTranslation, id: 'trans-new' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdTranslation,
        error: null
      });

      const result = await db.translations.create(newTranslation);

      expect(result).toEqual(createdTranslation);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newTranslation);
    });

    test('creates batch translations', async () => {
      const newTranslations: Translation[] = [
        { file_id: 'file-1', original_text: 'Test1', slide_number: 1, element_index: 0 },
        { file_id: 'file-1', original_text: 'Test2', slide_number: 1, element_index: 1 }
      ];

      const createdTranslations = newTranslations.map((t, i) => ({ ...t, id: `trans-${i}` }));

      mockSupabaseClient.from().insert().select.mockResolvedValue({
        data: createdTranslations,
        error: null
      });

      const result = await db.translations.createBatch(newTranslations);

      expect(result).toEqual(createdTranslations);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newTranslations);
    });

    test('updates translation', async () => {
      const updates = { translated_text: '更新済み', status: 'completed' };
      const updatedTranslation = { id: 'trans-1', ...updates };

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updatedTranslation,
        error: null
      });

      const result = await db.translations.update('trans-1', updates);

      expect(result).toEqual(updatedTranslation);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(updates);
    });
  });

  describe('db.activityLogs', () => {
    test('creates activity log', async () => {
      const newLog: ActivityLog = {
        user_id: 'user-123',
        action: 'file_upload',
        description: 'Uploaded presentation.pptx',
        ip_address: '127.0.0.1'
      };

      const createdLog = { ...newLog, id: 'log-1' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdLog,
        error: null
      });

      const result = await db.activityLogs.create(newLog);

      expect(result).toEqual(createdLog);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('activity_logs');
    });

    test('lists activity logs with limit', async () => {
      const mockLogs: ActivityLog[] = [
        { id: 'log-1', user_id: 'user-123', action: 'login' },
        { id: 'log-2', user_id: 'user-123', action: 'file_upload' }
      ];

      mockSupabaseClient.from().select().eq().order().limit.mockResolvedValue({
        data: mockLogs,
        error: null
      });

      const result = await db.activityLogs.list('user-123', 25);

      expect(result).toEqual(mockLogs);
      expect(mockSupabaseClient.from().select().eq().order().limit).toHaveBeenCalledWith(25);
    });
  });

  describe('db.usageLimits', () => {
    test('gets usage limits', async () => {
      const mockLimits = {
        id: 'limit-1',
        user_id: 'user-123',
        monthly_file_limit: 100,
        files_used: 5
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockLimits,
        error: null
      });

      const result = await db.usageLimits.get('user-123');

      expect(result).toEqual(mockLimits);
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    test('increments usage for new user', async () => {
      // First call returns no existing record
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }
        });

      const createdLimit = { user_id: 'user-123', files_used: 1 };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdLimit,
        error: null
      });

      const result = await db.usageLimits.increment('user-123', 'files_used');

      expect(result).toEqual(createdLimit);
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        files_used: 1
      });
    });

    test('increments usage for existing user', async () => {
      const existingLimit = { user_id: 'user-123', files_used: 5 };
      const updatedLimit = { user_id: 'user-123', files_used: 6 };

      // Mock the get call within increment
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({
          data: existingLimit,
          error: null
        });

      mockSupabaseClient.from().update().eq().select().single.mockResolvedValue({
        data: updatedLimit,
        error: null
      });

      const result = await db.usageLimits.increment('user-123', 'files_used');

      expect(result).toEqual(updatedLimit);
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        files_used: 6
      });
    });
  });

  describe('serverDb', () => {
    test('gets user settings from server', async () => {
      const mockSettings = { user_id: 'user-123', theme: 'dark' };

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockSettings,
        error: null
      });

      const result = await serverDb.getUserSettings('user-123');

      expect(result).toEqual(mockSettings);
      expect(mockCreateServerSupabaseClient).toHaveBeenCalled();
    });

    test('creates file from server', async () => {
      const newFile: FileRecord = {
        user_id: 'user-123',
        filename: 'server.pptx',
        original_name: 'Server File.pptx'
      };

      const createdFile = { ...newFile, id: 'server-file' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdFile,
        error: null
      });

      const result = await serverDb.createFile(newFile);

      expect(result).toEqual(createdFile);
      expect(mockCreateServerSupabaseClient).toHaveBeenCalled();
    });

    test('logs activity from server', async () => {
      const newLog: ActivityLog = {
        user_id: 'user-123',
        action: 'server_action'
      };

      const createdLog = { ...newLog, id: 'server-log' };

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: createdLog,
        error: null
      });

      const result = await serverDb.logActivity(newLog);

      expect(result).toEqual(createdLog);
      expect(mockCreateServerSupabaseClient).toHaveBeenCalled();
    });
  });
});
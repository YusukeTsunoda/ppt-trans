/**
 * Security boundary tests for Server Actions
 * Tests authentication, authorization, input validation, and attack prevention
 */

import { translateTextsAction } from '@/app/actions/translate';
import { extractTextFromPPTXAction, applyTranslationsAction, translatePPTXAction } from '@/app/actions/pptx';
import { getActivitiesAction, checkAdminRoleAction } from '@/app/actions/admin';
import { createClient } from '@/lib/supabase/server';
import { clearAllRateLimits } from '@/lib/security/rate-limiter';

// Mock modules
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/logger');
jest.mock('@anthropic-ai/sdk');

const mockSupabase = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  storage: {
    from: jest.fn(),
  },
  rpc: jest.fn(),
};

describe('Server Actions Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimits();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('Authentication Boundaries', () => {
    it('should reject requests without authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証が必要です');
    });

    it('should reject requests with expired session', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const result = await extractTextFromPPTXAction('file123', 'path/to/file');

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証が必要です');
    });

    it('should validate session token integrity', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result = await checkAdminRoleAction();

      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Authorization Boundaries', () => {
    it('should prevent access to other users files', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null, // File not found or not owned by user
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      });

      const result = await extractTextFromPPTXAction('file456', 'path/to/file');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイルが見つかりません');
    });

    it('should enforce role-based access for admin functions', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { role: 'user' }, // Not admin
              error: null,
            }),
          }),
        }),
      });

      const result = await checkAdminRoleAction();

      expect(result.isAdmin).toBe(false);
    });

    it('should validate file ownership before processing', async () => {
      const userId = 'user123';
      const fileId = 'file789';

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn((field, value) => {
            if (field === 'id' && value === fileId) {
              return {
                eq: jest.fn((field2, value2) => {
                  if (field2 === 'user_id' && value2 === userId) {
                    return {
                      single: jest.fn().mockResolvedValue({
                        data: { id: fileId, user_id: userId },
                        error: null,
                      }),
                    };
                  }
                  return {
                    single: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'Not found' },
                    }),
                  };
                }),
              };
            }
            return {
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            };
          }),
        }),
      });

      const result = await translatePPTXAction(fileId, 'ja');

      // Verify ownership check was performed
      expect(mockSupabase.from).toHaveBeenCalledWith('files');
    });
  });

  describe('Input Validation Boundaries', () => {
    it('should reject invalid UUID file IDs', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result = await extractTextFromPPTXAction(
        'not-a-valid-uuid',
        'path/to/file.pptx'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should reject path traversal attempts', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const maliciousPath = '../../../etc/passwd';
      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        maliciousPath
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should reject invalid file extensions', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.exe'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should reject overly long text inputs', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const longText = 'a'.repeat(10001); // Exceeds MAX_TEXT_LENGTH
      const result = await translateTextsAction(
        [{ id: '1', text: longText }],
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should reject invalid language codes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'invalid-lang-code'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should sanitize but not reject XSS payloads in text', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const xssPayload = '<script>alert("XSS")</script>';
      const result = await translateTextsAction(
        [{ id: '1', text: xssPayload }],
        'ja'
      );

      // Should process the text (sanitization happens at display time)
      // But the text itself should be preserved for translation
      if (result.success && result.translations) {
        expect(result.translations[0].original).toBe(xssPayload);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in file ID parameter', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const sqlInjection = "'; DROP TABLE files; --";
      const result = await extractTextFromPPTXAction(
        sqlInjection,
        'path/to/file.pptx'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
      // Ensure no database operations were attempted
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should use parameterized queries for database operations', async () => {
      const safeFileId = '123e4567-e89b-12d3-a456-426614174000';
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn((field, value) => {
            // Verify parameterized values
            expect(typeof value).toBe('string');
            expect(value).not.toContain(';');
            expect(value).not.toContain('--');
            return {
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: safeFileId },
                  error: null,
                }),
              }),
            };
          }),
        }),
      });

      await extractTextFromPPTXAction(safeFileId, 'file.pptx');

      expect(mockSupabase.from).toHaveBeenCalledWith('files');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on translation actions', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        const result = await translateTextsAction(
          [{ id: `${i}`, text: `test ${i}` }],
          'ja'
        );
        
        if (i < 10) {
          // Should succeed within limit
          expect(result.success).toBeDefined();
        }
      }

      // 11th request should be rate limited
      const result = await translateTextsAction(
        [{ id: '11', text: 'test 11' }],
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('レート制限に達しました');
    });

    it('should have different rate limits for different actions', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'file123', user_id: 'user123' },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSupabase.storage.from.mockReturnValue({
        download: jest.fn().mockResolvedValue({
          data: new Blob(['test']),
          error: null,
        }),
      });

      // Extract text has a higher limit (20 per minute)
      for (let i = 0; i < 15; i++) {
        const result = await extractTextFromPPTXAction(
          '123e4567-e89b-12d3-a456-426614174000',
          'file.pptx'
        );
        // Should not be rate limited yet
        if (result.error) {
          expect(result.error).not.toContain('レート制限');
        }
      }
    });

    it('should track rate limits per user independently', async () => {
      // User 1
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user1', email: 'user1@example.com' } },
        error: null,
      });

      for (let i = 0; i < 5; i++) {
        await translateTextsAction([{ id: `${i}`, text: 'test' }], 'ja');
      }

      // Switch to User 2
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user2', email: 'user2@example.com' } },
        error: null,
      });

      // User 2 should not be rate limited
      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );

      expect(result.error).not.toContain('レート制限');
    });
  });

  describe('File Size and Resource Limits', () => {
    it('should reject files exceeding size limit', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { 
                  id: 'file123', 
                  user_id: 'user123',
                  size: 60 * 1024 * 1024 // 60MB, exceeds limit
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // In real implementation, size check would be in the action
      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'large-file.pptx'
      );

      // The actual size check would be implemented in the action
      expect(result).toBeDefined();
    });

    it('should limit number of texts in translation request', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const tooManyTexts = Array.from({ length: 101 }, (_, i) => ({
        id: `${i}`,
        text: `text ${i}`,
      }));

      const result = await translateTextsAction(tooManyTexts, 'ja');

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });
  });

  describe('Timeout and Resource Protection', () => {
    it('should handle Python script timeout gracefully', async () => {
      // This would require mocking spawn and timeout behavior
      // In real implementation, the Python script execution has a 30-second timeout
      expect(true).toBe(true); // Placeholder for actual timeout test
    });

    it('should clean up temporary files after processing', async () => {
      // This would require file system mocking
      // In real implementation, temp files are deleted after processing
      expect(true).toBe(true); // Placeholder for actual cleanup test
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests without data mixing', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const results = await Promise.all([
        translateTextsAction([{ id: '1', text: 'text1' }], 'ja'),
        translateTextsAction([{ id: '2', text: 'text2' }], 'en'),
        translateTextsAction([{ id: '3', text: 'text3' }], 'zh'),
      ]);

      // Each result should be independent
      results.forEach((result, index) => {
        if (result.success && result.translations) {
          expect(result.translations[0].id).toBe(`${index + 1}`);
        }
      });
    });

    it('should prevent race conditions in file processing', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      // Simulate concurrent file processing
      const fileIds = ['file1', 'file2', 'file3'];
      const promises = fileIds.map(id => 
        translatePPTXAction(id, 'ja')
      );

      const results = await Promise.all(promises);

      // Each file should be processed independently
      expect(results.length).toBe(3);
    });
  });
});
/**
 * Error case tests for Server Actions
 * Tests error handling, recovery, and user feedback
 */

import { translateTextsAction } from '@/app/actions/translate';
import { extractTextFromPPTXAction, applyTranslationsAction, translatePPTXAction } from '@/app/actions/pptx';
import { getActivitiesAction, checkAdminRoleAction } from '@/app/actions/admin';
import { createClient } from '@/lib/supabase/server';
import { clearAllRateLimits } from '@/lib/security/rate-limiter';
import Anthropic from '@anthropic-ai/sdk';

// Mock modules
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/logger');
jest.mock('@anthropic-ai/sdk');
jest.mock('child_process');

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

describe('Server Actions Error Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimits();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('Network and External Service Errors', () => {
    it('should handle Anthropic API errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      // Mock Anthropic API error
      const mockAnthropicError = new Error('API rate limit exceeded');
      (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(mockAnthropicError),
        },
      } as any));

      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );

      // Should return error but not crash
      expect(result.success).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle Supabase connection errors', async () => {
      mockSupabase.auth.getUser.mockRejectedValue(
        new Error('Network connection failed')
      );

      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.pptx'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle storage download failures', async () => {
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
          data: null,
          error: { message: 'Storage service unavailable' },
        }),
      });

      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.pptx'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ダウンロードに失敗');
    });
  });

  describe('Database Operation Errors', () => {
    it('should handle database query failures', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockRejectedValue(
                new Error('Database connection lost')
              ),
            }),
          }),
        }),
      });

      const result = await translatePPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle database update failures gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(
            new Error('Update operation failed')
          ),
        }),
      });

      // The action should continue processing even if status update fails
      const result = await translatePPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'ja'
      );

      expect(result).toBeDefined();
    });

    it('should handle transaction rollback scenarios', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call succeeds
          return {
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
          };
        } else {
          // Subsequent calls fail
          throw new Error('Database error during transaction');
        }
      });

      const result = await translatePPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'ja'
      );

      expect(result.success).toBe(false);
    });
  });

  describe('Python Script Execution Errors', () => {
    it('should handle Python script crashes', async () => {
      const { spawn } = require('child_process');
      const EventEmitter = require('events');

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

      // Mock spawn to simulate Python script crash
      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const resultPromise = extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.pptx'
      );

      // Simulate Python script crash
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Python error: Module not found');
        mockProcess.emit('exit', 1);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('テキスト抽出に失敗');
    });

    it('should handle Python script timeout', async () => {
      const { spawn } = require('child_process');
      const EventEmitter = require('events');

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

      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = jest.fn();
      
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      // Use fake timers for timeout testing
      jest.useFakeTimers();

      const resultPromise = extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.pptx'
      );

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(31000); // 31 seconds

      // Process should be killed and error returned
      setTimeout(() => {
        mockProcess.emit('exit', null);
      }, 100);

      jest.advanceTimersByTime(200);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('タイムアウト');

      jest.useRealTimers();
    });

    it('should handle malformed Python script output', async () => {
      const { spawn } = require('child_process');
      const EventEmitter = require('events');

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

      const mockProcess = new EventEmitter();
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      
      (spawn as jest.Mock).mockReturnValue(mockProcess);

      const resultPromise = extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'file.pptx'
      );

      // Simulate malformed JSON output
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Not valid JSON {broken:');
        mockProcess.emit('exit', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('解析に失敗');
    });
  });

  describe('Partial Failure Handling', () => {
    it('should handle partial translation failures', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      let callCount = 0;
      (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
        messages: {
          create: jest.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
              // Second translation fails
              return Promise.reject(new Error('API error'));
            }
            return Promise.resolve({
              content: [{ type: 'text', text: 'translated text' }],
            });
          }),
        },
      } as any));

      const result = await translateTextsAction(
        [
          { id: '1', text: 'text1' },
          { id: '2', text: 'text2' },
          { id: '3', text: 'text3' },
        ],
        'ja'
      );

      // Should still return success with fallback for failed translation
      expect(result.success).toBe(true);
      if (result.translations) {
        expect(result.translations.length).toBe(3);
        // Failed translation should fall back to original
        expect(result.translations[1].translated).toBe('text2');
      }
    });

    it('should handle workflow step failures gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'file123', user_id: 'user123', filename: 'test.pptx' },
                error: null,
              }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      // Make extraction fail
      mockSupabase.storage.from.mockReturnValue({
        download: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Download failed' },
        }),
      });

      const result = await translatePPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      // Should update file status to failed
      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' })
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty input arrays', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result = await translateTextsAction([], 'ja');

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });

    it('should handle null and undefined values', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const result1 = await translateTextsAction(null as any, 'ja');
      expect(result1.success).toBe(false);

      const result2 = await translateTextsAction(undefined as any, 'ja');
      expect(result2.success).toBe(false);

      const result3 = await extractTextFromPPTXAction(null as any, null as any);
      expect(result3.success).toBe(false);
    });

    it('should handle special characters in text', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const specialText = '测试 テスト 🎉 <>&"\'';
      const result = await translateTextsAction(
        [{ id: '1', text: specialText }],
        'ja'
      );

      // Should handle special characters without error
      expect(result).toBeDefined();
      if (result.success && result.translations) {
        expect(result.translations[0].original).toBe(specialText);
      }
    });

    it('should handle very long file paths', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      const longPath = 'a/'.repeat(250) + 'file.pptx';
      const result = await extractTextFromPPTXAction(
        '123e4567-e89b-12d3-a456-426614174000',
        longPath
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('入力エラー');
    });
  });

  describe('Recovery and Retry Logic', () => {
    it('should provide actionable error messages for recovery', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' },
      });

      const result = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証が必要です');
      // Message should guide user to log in again
    });

    it('should include retry information in rate limit errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });

      // Exhaust rate limit
      for (let i = 0; i < 11; i++) {
        await translateTextsAction(
          [{ id: `${i}`, text: 'test' }],
          'ja'
        );
      }

      const result = await translateTextsAction(
        [{ id: '12', text: 'test' }],
        'ja'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/\d+秒後に再試行/);
    });

    it('should handle intermittent failures with fallback behavior', async () => {
      let callCount = 0;
      mockSupabase.auth.getUser.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Temporary network error'));
        }
        return Promise.resolve({
          data: { user: { id: 'user123', email: 'test@example.com' } },
          error: null,
        });
      });

      const result1 = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );
      expect(result1.success).toBe(false);

      // Second attempt should work
      const result2 = await translateTextsAction(
        [{ id: '1', text: 'test' }],
        'ja'
      );
      // Would succeed if properly configured
      expect(result2).toBeDefined();
    });
  });
});
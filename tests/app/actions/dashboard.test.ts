import { getFiles, translateFileAction, deleteFileAction } from '@/app/actions/dashboard';
import { createClient } from '@/lib/supabase/server';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

describe('Dashboard Actions', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn(),
    storage: {
      from: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('getFiles', () => {
    it('ユーザーのファイル一覧を取得する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      const mockFiles = [
        {
          id: 'file-1',
          filename: 'test1.pptx',
          original_name: 'test1.pptx',
          file_size: 1024000,
          status: 'uploaded',
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'file-2',
          filename: 'test2.pptx',
          original_name: 'test2.pptx',
          file_size: 2048000,
          status: 'completed',
          created_at: '2024-01-02T00:00:00Z'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockFiles,
              error: null
            })
          })
        })
      });

      const result = await getFiles();

      expect(result.files).toHaveLength(2);
      expect(result.files[0].id).toBe('file-1');
      expect(mockSupabase.from).toHaveBeenCalledWith('files');
    });

    it('認証されていない場合エラーを返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      const result = await getFiles();

      expect(result.error).toBe('認証が必要です');
      expect(result.files).toEqual([]);
    });

    it('データベースエラーを処理する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      const result = await getFiles();

      expect(result.error).toBe('ファイルの取得に失敗しました');
      expect(result.files).toEqual([]);
    });
  });

  describe('translateFileAction', () => {
    it('ファイルの翻訳を開始する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'file-1',
                filename: 'test.pptx',
                status: 'uploaded'
              },
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          translatedPath: 'translated/test.pptx'
        })
      });

      const result = await translateFileAction('file-1');

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/translate'),
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('ファイルが見つからない場合エラーを返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      const result = await translateFileAction('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイルが見つかりません');
    });

    it('翻訳APIエラーを処理する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'file-1',
                filename: 'test.pptx',
                status: 'uploaded'
              },
              error: null
            })
          })
        })
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'Translation failed'
        })
      });

      const result = await translateFileAction('file-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('翻訳に失敗しました');
    });
  });

  describe('deleteFileAction', () => {
    it('ファイルを削除する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'file-1',
                filename: 'storage/test.pptx',
                translation_result: {
                  translated_path: 'storage/translated.pptx'
                }
              },
              error: null
            })
          })
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockSupabase.storage.from.mockReturnValue({
        remove: jest.fn().mockResolvedValue({
          error: null
        })
      });

      const result = await deleteFileAction('file-1');

      expect(result.success).toBe(true);
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('uploads');
    });

    it('ファイルが見つからない場合エラーを返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      const result = await deleteFileAction('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイルが見つかりません');
    });

    it('ストレージ削除エラーを処理する', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-id' } },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'file-1',
                filename: 'storage/test.pptx'
              },
              error: null
            })
          })
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockSupabase.storage.from.mockReturnValue({
        remove: jest.fn().mockResolvedValue({
          error: { message: 'Storage error' }
        })
      });

      const result = await deleteFileAction('file-1');

      // ストレージエラーがあっても、DBから削除されていれば成功とする
      expect(result.success).toBe(true);
    });
  });
});
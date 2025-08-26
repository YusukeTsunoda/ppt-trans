import { deleteFileAction, downloadFileAction } from '@/app/actions/files';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import logger from '@/lib/logger';

// Supabaseクライアントのモック
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}));

// Next.jsのモック
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

// ロガーのモック
jest.mock('@/lib/logger', () => {
  return {
    __esModule: true,
    default: {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  };
});

describe('Files Actions', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn()
    },
    storage: {
      from: jest.fn(() => ({
        remove: jest.fn(),
        createSignedUrl: jest.fn()
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          }))
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    }))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('deleteFileAction', () => {
    describe('正常系', () => {
      it('ファイルを正常に削除する', async () => {
        const mockUser = { id: 'user-123', email: 'test@example.com' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          filename: 'test.pptx',
          file_path: 'user-123/test.pptx',
          translation_result: null
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            }))
          }))
        }));

        const removeMock = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: removeMock,
          createSignedUrl: jest.fn()
        }));

        const result = await deleteFileAction('file-456');

        expect(result.success).toBe(true);
        expect(result.message).toBe('ファイルを削除しました');
        expect(removeMock).toHaveBeenCalledWith(['user-123/test.pptx']);
        expect(revalidatePath).toHaveBeenCalledWith('/files');
      });

      it('翻訳済みファイルも含めて削除する', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          file_path: 'user-123/original.pptx',
          translation_result: {
            translated_path: 'user-123/translated.pptx'
          }
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            }))
          }))
        }));

        const removeMock = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: removeMock,
          createSignedUrl: jest.fn()
        }));

        const result = await deleteFileAction('file-456');

        expect(result.success).toBe(true);
        expect(removeMock).toHaveBeenCalledTimes(2);
        expect(removeMock).toHaveBeenCalledWith(['user-123/original.pptx']);
        expect(removeMock).toHaveBeenCalledWith(['user-123/translated.pptx']);
      });

      it('storage_pathフィールドを使用してファイルを削除する', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          storage_path: 'user-123/storage.pptx',
          file_path: null,
          filename: null,
          translation_result: null
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            }))
          }))
        }));

        const removeMock = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: removeMock,
          createSignedUrl: jest.fn()
        }));

        const result = await deleteFileAction('file-456');

        expect(result.success).toBe(true);
        expect(removeMock).toHaveBeenCalledWith(['user-123/storage.pptx']);
      });
    });

    describe('エラー系', () => {
      it('未認証の場合エラーを返す', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        });

        const result = await deleteFileAction('file-456');

        expect(result.error).toBe('Unauthorized');
        expect(result.success).toBeUndefined();
      });

      it('ファイルIDが空の場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        const result = await deleteFileAction('');

        expect(result.error).toBe('File ID is required');
      });

      it('ファイルが見つからない場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Not found')
                })
              }))
            }))
          }))
        }));

        const result = await deleteFileAction('file-456');

        expect(result.error).toBe('ファイルが見つかりません');
        expect(logger.error).toHaveBeenCalled();
      });

      it('ストレージ削除エラーでもDB削除を続行する', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          file_path: 'user-123/test.pptx'
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                error: null
              })
            }))
          }))
        }));

        const removeMock = jest.fn().mockResolvedValue({ 
          error: new Error('Storage error') 
        });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: removeMock,
          createSignedUrl: jest.fn()
        }));

        const result = await deleteFileAction('file-456');

        expect(result.success).toBe(true);
        expect(logger.error).toHaveBeenCalledWith('Storage deletion error:', expect.any(Object));
      });

      it('データベース削除エラーの場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          file_path: 'user-123/test.pptx'
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          })),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn().mockResolvedValue({
                error: new Error('DB error')
              })
            }))
          }))
        }));

        const result = await deleteFileAction('file-456');

        expect(result.error).toBe('ファイルの削除に失敗しました');
        expect(logger.error).toHaveBeenCalledWith('Database deletion error:', expect.any(Object));
      });

      it('予期しないエラーを処理する', async () => {
        (createClient as jest.Mock).mockRejectedValue(new Error('Unexpected'));

        const result = await deleteFileAction('file-456');

        expect(result.error).toBe('An unexpected error occurred');
        expect(logger.error).toHaveBeenCalledWith('Delete error:', expect.any(Error));
      });
    });
  });

  describe('downloadFileAction', () => {
    describe('正常系', () => {
      it('オリジナルファイルのダウンロードURLを生成する', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          storage_path: 'user-123/original.pptx',
          translation_result: null
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          }))
        }));

        const createSignedUrlMock = jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed-url' },
          error: null
        });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: jest.fn(),
          createSignedUrl: createSignedUrlMock
        }));

        const result = await downloadFileAction('file-456', 'original');

        expect(result.success).toBe(true);
        expect(result.message).toBe('https://example.com/signed-url');
        expect(createSignedUrlMock).toHaveBeenCalledWith('user-123/original.pptx', 60);
      });

      it('翻訳済みファイルのダウンロードURLを生成する', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          storage_path: 'user-123/original.pptx',
          translation_result: {
            translated_path: 'user-123/translated.pptx'
          }
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          }))
        }));

        const createSignedUrlMock = jest.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/translated-url' },
          error: null
        });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: jest.fn(),
          createSignedUrl: createSignedUrlMock
        }));

        const result = await downloadFileAction('file-456', 'translated');

        expect(result.success).toBe(true);
        expect(result.message).toBe('https://example.com/translated-url');
        expect(createSignedUrlMock).toHaveBeenCalledWith('user-123/translated.pptx', 60);
      });
    });

    describe('エラー系', () => {
      it('未認証の場合エラーを返す', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null
        });

        const result = await downloadFileAction('file-456', 'original');

        expect(result.error).toBe('Unauthorized');
      });

      it('パラメータが不正な場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        let result = await downloadFileAction('', 'original');
        expect(result.error).toBe('Invalid parameters');

        result = await downloadFileAction('file-456', null as any);
        expect(result.error).toBe('Invalid parameters');
      });

      it('ファイルが見つからない場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Not found')
                })
              }))
            }))
          }))
        }));

        const result = await downloadFileAction('file-456', 'original');

        expect(result.error).toBe('File not found');
      });

      it('ファイルパスが見つからない場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          storage_path: null,
          translation_result: null
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          }))
        }));

        const result = await downloadFileAction('file-456', 'original');

        expect(result.error).toBe('File path not found');
      });

      it('署名付きURL生成エラーの場合エラーを返す', async () => {
        const mockUser = { id: 'user-123' };
        const mockFile = {
          id: 'file-456',
          user_id: 'user-123',
          storage_path: 'user-123/original.pptx'
        };

        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null
        });

        mockSupabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn().mockResolvedValue({
                  data: mockFile,
                  error: null
                })
              }))
            }))
          }))
        }));

        const createSignedUrlMock = jest.fn().mockResolvedValue({
          data: null,
          error: new Error('URL generation failed')
        });
        mockSupabase.storage.from = jest.fn(() => ({
          remove: jest.fn(),
          createSignedUrl: createSignedUrlMock
        }));

        const result = await downloadFileAction('file-456', 'original');

        expect(result.error).toBe('Failed to generate download URL');
      });

      it('予期しないエラーを処理する', async () => {
        (createClient as jest.Mock).mockRejectedValue(new Error('Unexpected'));

        const result = await downloadFileAction('file-456', 'original');

        expect(result.error).toBe('An unexpected error occurred');
        expect(logger.error).toHaveBeenCalledWith('Download error:', expect.any(Error));
      });
    });
  });
});
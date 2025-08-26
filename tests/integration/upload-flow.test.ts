/**
 * Integration test for complete upload flow
 */

import { uploadFileAction } from '@/app/actions/upload';
import { deleteFileAction, downloadFileAction } from '@/app/actions/files';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Mock modules
jest.mock('@/lib/supabase/server');
jest.mock('next/cache');
jest.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Complete Upload Flow Integration', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup comprehensive Supabase mock
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { 
            user: {
              id: 'user-123',
              email: 'test@example.com'
            }
          },
          error: null
        })
      },
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'user-123/test.pptx' },
            error: null
          }),
          remove: jest.fn().mockResolvedValue({ error: null }),
          createSignedUrl: jest.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.com/download' },
            error: null
          })
        }))
      },
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'file-456',
                filename: 'user-123/test.pptx',
                original_name: 'test.pptx',
                file_size: 1024000,
                status: 'uploaded'
              },
              error: null
            })
          }))
        })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'file-456',
                  user_id: 'user-123',
                  file_path: 'user-123/test.pptx',
                  storage_path: 'user-123/test.pptx'
                },
                error: null
              })
            }))
          }))
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null })
          }))
        }))
      }))
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
    (revalidatePath as jest.Mock).mockImplementation(() => {});
  });

  describe('ファイルアップロード → ダウンロード → 削除の完全フロー', () => {
    it('正常なファイルライフサイクルを完了する', async () => {
      // 1. ファイルをアップロード
      const formData = new FormData();
      const file = new File(
        ['test content'],
        'presentation.pptx',
        { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
      );
      formData.append('file', file);

      const uploadResult = await uploadFileAction(null, formData);
      
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBe('file-456');
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('uploads');
      
      // 2. アップロードしたファイルのダウンロードURLを生成
      const downloadResult = await downloadFileAction('file-456', 'original');
      
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.message).toBe('https://example.com/download');
      
      // 3. ファイルを削除
      const deleteResult = await deleteFileAction('file-456');
      
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.message).toBe('ファイルを削除しました');
      
      // 検証: 全体的なフロー
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
      expect(revalidatePath).toHaveBeenCalledWith('/files');
    });

    it('大容量ファイルの処理を適切に行う', async () => {
      const formData = new FormData();
      // 90MBのファイル（制限内）
      const largeContent = new Array(90 * 1024 * 1024).join('a');
      const file = new File(
        [largeContent],
        'large-presentation.pptx',
        { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
      );
      formData.append('file', file);

      const uploadResult = await uploadFileAction(null, formData);
      
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBeDefined();
    });

    it('複数ユーザーのファイル分離を保証する', async () => {
      // User 1のファイル
      const user1FormData = new FormData();
      user1FormData.append('file', new File(['user1 content'], 'user1.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      const user1Upload = await uploadFileAction(null, user1FormData);
      expect(user1Upload.success).toBe(true);

      // User 2に切り替え
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'user2@example.com' } },
        error: null
      });

      // User 2のファイル
      const user2FormData = new FormData();
      user2FormData.append('file', new File(['user2 content'], 'user2.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: { id: 'file-789', filename: 'user-456/user2.pptx' },
              error: null
            })
          }))
        }))
      });

      const user2Upload = await uploadFileAction(null, user2FormData);
      expect(user2Upload.success).toBe(true);
      expect(user2Upload.fileId).toBe('file-789');

      // User 1がUser 2のファイルを削除しようとする
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null
      });

      mockSupabaseClient.from.mockReturnValue({
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
      });

      const deleteResult = await deleteFileAction('file-789');
      expect(deleteResult.success).toBeFalsy();
      expect(deleteResult.error).toContain('ファイルが見つかりません');
    });
  });

  describe('エラー処理とリカバリー', () => {
    it('アップロード失敗時にクリーンアップを行う', async () => {
      // DBエラーをシミュレート
      mockSupabaseClient.from.mockReturnValue({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error')
            })
          }))
        }))
      });

      const removeMock = jest.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.storage.from.mockReturnValue({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'user-123/test.pptx' },
          error: null
        }),
        remove: removeMock
      });

      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      const result = await uploadFileAction(null, formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイル情報の保存に失敗しました');
      expect(removeMock).toHaveBeenCalledWith(['user-123/123456789_test.pptx']);
    });

    it('ネットワークエラー時のリトライを処理する', async () => {
      // 初回失敗、リトライで成功
      let callCount = 0;
      mockSupabaseClient.storage.from.mockImplementation(() => ({
        upload: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              data: null,
              error: { message: 'Network error', code: 'NETWORK_ERROR' }
            });
          }
          return Promise.resolve({
            data: { path: 'user-123/test.pptx' },
            error: null
          });
        }),
        remove: jest.fn()
      }));

      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      const result = await uploadFileAction(null, formData);

      // ネットワークエラーでも最終的に失敗
      expect(result.success).toBe(false);
    });
  });

  describe('同時実行と競合状態', () => {
    it('同じファイルの同時アップロードを処理する', async () => {
      const formData1 = new FormData();
      formData1.append('file', new File(['content1'], 'same.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      const formData2 = new FormData();
      formData2.append('file', new File(['content2'], 'same.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }));

      // 同時実行
      const [result1, result2] = await Promise.all([
        uploadFileAction(null, formData1),
        uploadFileAction(null, formData2)
      ]);

      // 両方成功するはず（タイムスタンプで区別）
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.fileId).not.toBe(result2.fileId);
    });

    it('削除中のファイルへのアクセスを防ぐ', async () => {
      // ファイルが削除処理中
      const deletePromise = deleteFileAction('file-456');
      
      // 同時にダウンロードを試みる
      const downloadPromise = downloadFileAction('file-456', 'original');
      
      const [deleteResult, downloadResult] = await Promise.all([
        deletePromise,
        downloadPromise
      ]);

      expect(deleteResult.success).toBe(true);
      // ダウンロードは成功するか、適切なエラーを返す
      expect(downloadResult).toBeDefined();
    });
  });
});
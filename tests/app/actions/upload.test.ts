import { uploadFileAction } from '@/app/actions/upload';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import logger from '@/lib/logger';
import { aUser, aFile, aFormData, aSupabaseMock, aSupabaseResponse } from '../../builders';
import { fixtures } from '../../fixtures';

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

describe('uploadFileAction', () => {
  let mockSupabase: ReturnType<typeof aSupabaseMock>['build'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = aSupabaseMock()
      .withAuth()
      .withStorage()
      .withDatabase()
      .build();
    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('正常系', () => {
    it('PowerPointファイルを正常にアップロードする', async () => {
      const mockUser = aUser()
        .withId('user-123')
        .withEmail('test@example.com')
        .build();
      
      const mockFileRecord = aFile()
        .withId('file-456')
        .withName('test.pptx')
        .withSize(1024000)
        .withStatus('uploaded')
        .forUser('user-123')
        .build();

      mockSupabase.auth.getUser.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: mockUser })
          .build()
      );

      const uploadMock = jest.fn().mockResolvedValue(
        aSupabaseResponse()
          .withData({ path: 'user-123/123456789_test.pptx' })
          .build()
      );
      
      mockSupabase.storage.from = jest.fn(() => ({
        upload: uploadMock,
        remove: jest.fn(),
        download: jest.fn(),
        createSignedUrl: jest.fn(),
        getPublicUrl: jest.fn()
      }));

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue(
              aSupabaseResponse()
                .withData(mockFileRecord)
                .build()
            )
          }))
        })),
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }));

      const formData = aFormData()
        .withFile('file', 'content', 'test.pptx')
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('ファイルが正常にアップロードされました');
      expect(result.fileId).toBe('file-456');
      expect(uploadMock).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
      expect(revalidatePath).toHaveBeenCalledWith('/files');
    });

    it('.ppt形式のファイルもアップロードできる', async () => {
      const mockUser = aUser().withId('user-123').build();
      
      mockSupabase.auth.getUser.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: mockUser })
          .build()
      );

      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue(
          aSupabaseResponse()
            .withData({ path: 'path' })
            .build()
        ),
        remove: jest.fn(),
        download: jest.fn(),
        createSignedUrl: jest.fn(),
        getPublicUrl: jest.fn()
      }));

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue(
              aSupabaseResponse()
                .withData({ id: 'file-id' })
                .build()
            )
          }))
        })),
        select: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }));

      const formData = aFormData()
        .withFile('file', 'content', 'test.ppt', 'application/vnd.ms-powerpoint')
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.success).toBe(true);
    });
  });

  describe('バリデーションエラー', () => {
    it('ファイルが選択されていない場合エラーを返す', async () => {
      const formData = aFormData()
        .withField('file', '')
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('ファイルを選択してください');
      expect(result.success).toBeUndefined();
    });

    it('ファイルサイズが大きすぎる場合エラーを返す', async () => {
      // 101MBのファイル（制限は100MB）
      const formData = aFormData()
        .withLargeFile(101)
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.error).toContain('ファイルサイズが大きすぎます');
      expect(result.error).toContain('100MB');
      expect(result.success).toBeUndefined();
    });

    it('許可されていないファイル形式の場合エラーを返す', async () => {
      const formData = aFormData()
        .withInvalidFile()
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('PowerPointファイル（.ppt, .pptx）のみアップロード可能です');
      expect(result.success).toBeUndefined();
    });
  });

  describe('認証エラー', () => {
    it('未認証の場合エラーを返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: null })
          .build()
      );

      const formData = aFormData()
        .withFile()
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('認証が必要です。ログインしてください。');
      expect(result.success).toBeUndefined();
    });

    it('認証エラーが発生した場合エラーを返す', async () => {
      mockSupabase.auth.getUser.mockResolvedValue(
        aSupabaseResponse()
          .withData({ user: null })
          .withError('Auth error')
          .build()
      );

      const formData = aFormData()
        .withFile()
        .build();

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('認証が必要です。ログインしてください。');
    });
  });

  describe('ストレージエラー', () => {
    it('ストレージアップロードエラーの場合適切なメッセージを返す', async () => {
      const mockUser = { id: 'user-123' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Storage error')
        }),
        remove: jest.fn()
      }));

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('ファイルのアップロードに失敗しました');
      expect(logger.error).toHaveBeenCalledWith('Storage upload error:', expect.any(Error));
    });

    it('権限エラーの場合適切なメッセージを返す', async () => {
      const mockUser = { id: 'user-123' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const uploadError = new Error('row-level security policy violation');
      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'row-level security policy violation' }
        }),
        remove: jest.fn()
      }));

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('アップロード権限がありません。アカウント設定を確認してください。');
    });

    it('重複ファイルエラーの場合適切なメッセージを返す', async () => {
      const mockUser = { id: 'user-123' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'file already exists' }
        }),
        remove: jest.fn()
      }));

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('同名のファイルが既に存在します。');
    });
  });

  describe('データベースエラー', () => {
    it('DB保存エラーの場合ストレージからファイルを削除する', async () => {
      const mockUser = { id: 'user-123' };
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const removeMock = jest.fn();
      mockSupabase.storage.from = jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({
          data: { path: 'path' },
          error: null
        }),
        remove: removeMock
      }));

      mockSupabase.from = jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('DB error')
            })
          }))
        }))
      }));

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('ファイル情報の保存に失敗しました。もう一度お試しください。');
      expect(removeMock).toHaveBeenCalledWith([expect.stringContaining('test.pptx')]);
      expect(logger.error).toHaveBeenCalledWith('Database insert error:', expect.any(Error));
    });
  });

  describe('例外処理', () => {
    it('予期しないエラーの場合適切なメッセージを返す', async () => {
      (createClient as jest.Mock).mockRejectedValue(new Error('Unexpected error'));

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('予期しないエラーが発生しました。もう一度お試しください。');
      expect(logger.error).toHaveBeenCalledWith('Upload action error:', expect.any(Error));
    });

    it('タイムアウトエラーの場合適切なメッセージを返す', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      (createClient as jest.Mock).mockRejectedValue(abortError);

      const formData = new FormData();
      const file = new File(['content'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      formData.append('file', file);

      const result = await uploadFileAction(null, formData);

      expect(result.error).toBe('タイムアウト: アップロードに時間がかかりすぎています。もう一度お試しください。');
    });
  });
});
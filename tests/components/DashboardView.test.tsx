import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import DashboardView from '@/components/dashboard/DashboardView';
import { translateFileAction, deleteFileAction } from '@/app/actions/dashboard';
import { logoutAction } from '@/app/actions/auth';

// モック
jest.mock('@/app/actions/dashboard');
jest.mock('@/app/actions/auth');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        download: jest.fn().mockResolvedValue({
          data: new Blob(['test']),
          error: null,
        }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: jest.fn().mockResolvedValue({
            data: { role: 'user' },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('DashboardView', () => {
  const mockFiles = [
    {
      id: '1',
      filename: 'test.pptx',
      original_name: 'test.pptx',
      file_size: 1024000,
      status: 'uploaded',
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      filename: 'completed.pptx',
      original_name: 'completed.pptx',
      file_size: 2048000,
      status: 'completed',
      translation_result: {
        translated_path: 'translated/completed.pptx',
        slide_count: 10,
      },
      created_at: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ファイル一覧を正しく表示する', async () => {
    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });

    // ファイル名が表示されているか確認
    expect(screen.getByText('test.pptx')).toBeInTheDocument();
    expect(screen.getByText('completed.pptx')).toBeInTheDocument();
  });

  it('空のファイルリストを正しく表示する', () => {
    render(
      <DashboardView userEmail="test@example.com" initialFiles={[]} />
    );

    expect(screen.getByTestId('empty-file-list')).toBeInTheDocument();
    expect(screen.getByText('まだファイルがアップロードされていません')).toBeInTheDocument();
  });

  it('翻訳ボタンが正しく動作する', async () => {
    const mockTranslateAction = jest.fn().mockResolvedValue({
      success: true,
    });
    (translateFileAction as jest.Mock).mockImplementation(mockTranslateAction);

    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    // 翻訳ボタンを見つけてクリック
    const translateButtons = screen.getAllByText('🌐 翻訳');
    await userEvent.click(translateButtons[0]);

    await waitFor(() => {
      expect(mockTranslateAction).toHaveBeenCalledWith('1');
    });
  });

  it('ファイル削除機能が動作する', async () => {
    const mockDeleteAction = jest.fn().mockResolvedValue({
      success: true,
    });
    (deleteFileAction as jest.Mock).mockImplementation(mockDeleteAction);

    // window.confirmをモック
    global.confirm = jest.fn(() => true);

    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    // 削除ボタンを見つけてクリック
    const deleteButtons = screen.getAllByText('削除');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteAction).toHaveBeenCalledWith('1');
    });
  });

  it('ログアウトボタンが正しく動作する', async () => {
    const mockLogoutAction = jest.fn().mockResolvedValue({
      success: true,
    });
    (logoutAction as jest.Mock).mockImplementation(mockLogoutAction);

    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    // ログアウトボタンを見つけてクリック
    const logoutButton = screen.getByText('ログアウト');
    await userEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLogoutAction).toHaveBeenCalled();
    });
  });

  it('ファイルサイズを正しくフォーマットする', () => {
    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    // 1024000 bytes = 1000.0 KB
    expect(screen.getByText('1000.0 KB')).toBeInTheDocument();
    // 2048000 bytes = 2.0 MB
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('ステータスバッジを正しく表示する', () => {
    render(
      <DashboardView userEmail="test@example.com" initialFiles={mockFiles} />
    );

    expect(screen.getByText('アップロード済み')).toBeInTheDocument();
    expect(screen.getByText('完了')).toBeInTheDocument();
  });
});
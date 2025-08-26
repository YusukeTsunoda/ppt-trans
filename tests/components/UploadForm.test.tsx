import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UploadForm from '@/components/UploadForm';

// モック
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('UploadForm', () => {
  const mockOnUploadComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ファイル選択UI要素が表示される', () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    expect(screen.getByText(/ファイルを選択/)).toBeInTheDocument();
    expect(screen.getByText(/ドラッグ&ドロップ/)).toBeInTheDocument();
  });

  it('有効なPPTXファイルを受け入れる', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    expect(screen.getByText('presentation.pptx')).toBeInTheDocument();
  });

  it('無効なファイルタイプを拒否する', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'document.pdf', {
      type: 'application/pdf'
    });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('PowerPointファイル')
      );
    });
  });

  it('10MBを超えるファイルを拒否する', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, largeFile);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining('10MB以下')
      );
    });
  });

  it('ドラッグ&ドロップが機能する', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const dropZone = screen.getByTestId('drop-zone');
    
    // ドラッグエンター
    fireEvent.dragEnter(dropZone, {
      dataTransfer: { files: [file] }
    });
    expect(dropZone).toHaveClass('drag-active');

    // ドロップ
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByText('presentation.pptx')).toBeInTheDocument();
    });
  });

  it('アップロード中は適切な状態を表示する', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    const uploadButton = screen.getByText('アップロード');
    await userEvent.click(uploadButton);

    expect(screen.getByText(/アップロード中/)).toBeInTheDocument();
    expect(uploadButton).toBeDisabled();
  });

  it('アップロード進捗が表示される', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    const uploadButton = screen.getByText('アップロード');
    await userEvent.click(uploadButton);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('ファイルをクリアできる', async () => {
    render(
      <UploadForm 
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    );

    const file = new File(['test'], 'presentation.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    const input = screen.getByTestId('file-input');
    await userEvent.upload(input, file);

    expect(screen.getByText('presentation.pptx')).toBeInTheDocument();

    const clearButton = screen.getByTestId('clear-file');
    await userEvent.click(clearButton);

    expect(screen.queryByText('presentation.pptx')).not.toBeInTheDocument();
  });
});
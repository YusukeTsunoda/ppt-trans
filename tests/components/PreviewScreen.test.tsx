import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { PreviewScreen } from '@/components/PreviewScreen';
import type { ProcessingResult } from '@/types';

// モック
jest.mock('@/lib/settings', () => ({
  getSettings: () => ({
    targetLanguage: 'ja',
    apiKey: 'test-key'
  })
}));

jest.mock('@/lib/history', () => ({
  updateHistoryItem: jest.fn()
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true
  })
}));

describe('PreviewScreen', () => {
  const mockData: ProcessingResult = {
    slides: [
      {
        slideNumber: 1,
        imageUrl: '/test-image-1.png',
        texts: [
          { id: '1', content: 'Title', x: 100, y: 100 },
          { id: '2', content: 'Subtitle', x: 100, y: 200 }
        ]
      },
      {
        slideNumber: 2,
        imageUrl: '/test-image-2.png',
        texts: [
          { id: '3', content: 'Content', x: 100, y: 150 }
        ]
      }
    ],
    totalSlides: 2,
    extractedAt: new Date().toISOString()
  };

  const mockOnBack = jest.fn();
  const mockOnDataUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('スライドが正しく表示される', () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    expect(screen.getByText('スライド 1 / 2')).toBeInTheDocument();
    expect(screen.getByAltText('スライド 1')).toBeInTheDocument();
  });

  it('テキストコンテンツが表示される', () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('次のスライドに移動できる', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const nextButton = screen.getByTestId('next-slide');
    await userEvent.click(nextButton);

    expect(screen.getByText('スライド 2 / 2')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('前のスライドに戻れる', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    // 次のスライドへ
    const nextButton = screen.getByTestId('next-slide');
    await userEvent.click(nextButton);

    // 前のスライドへ
    const prevButton = screen.getByTestId('prev-slide');
    await userEvent.click(prevButton);

    expect(screen.getByText('スライド 1 / 2')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('最初のスライドで前ボタンが無効になる', () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const prevButton = screen.getByTestId('prev-slide');
    expect(prevButton).toBeDisabled();
  });

  it('最後のスライドで次ボタンが無効になる', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const nextButton = screen.getByTestId('next-slide');
    await userEvent.click(nextButton);

    expect(nextButton).toBeDisabled();
  });

  it('戻るボタンが機能する', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const backButton = screen.getByText('戻る');
    await userEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it('翻訳言語を選択できる', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const languageSelect = screen.getByTestId('language-select');
    await userEvent.selectOptions(languageSelect, 'en');

    expect(languageSelect).toHaveValue('en');
  });

  it('翻訳ボタンが機能する', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const translateButton = screen.getByText('翻訳開始');
    await userEvent.click(translateButton);

    await waitFor(() => {
      expect(screen.getByText(/翻訳中/)).toBeInTheDocument();
    });
  });

  it('ズーム機能が動作する', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const zoomInButton = screen.getByTestId('zoom-in');
    await userEvent.click(zoomInButton);

    const slideImage = screen.getByAltText('スライド 1');
    expect(slideImage).toHaveStyle({ transform: expect.stringContaining('scale(1.1)') });
  });

  it('エラー状態が表示される', () => {
    const errorData = { ...mockData, error: 'テスト エラー' };
    
    render(
      <PreviewScreen 
        data={errorData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    expect(screen.getByText('テスト エラー')).toBeInTheDocument();
  });

  it('ダウンロードボタンが機能する', async () => {
    render(
      <PreviewScreen 
        data={mockData}
        onBack={mockOnBack}
        onDataUpdate={mockOnDataUpdate}
      />
    );

    const downloadButton = screen.getByText('ダウンロード');
    await userEvent.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByText(/ダウンロード中/)).toBeInTheDocument();
    });
  });
});
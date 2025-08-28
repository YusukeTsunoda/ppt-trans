import { renderHook } from '@testing-library/react';
import { usePreviewOperations } from '@/hooks/usePreviewOperations';

describe('usePreviewOperations', () => {
  it('正しく初期化される', () => {
    const mockFile = {
      id: 'test-id',
      name: 'test.pptx',
      size: 1024,
      uploadedAt: '2024-01-01',
      status: 'processing' as const
    };
    
    const mockProps = {
      file: mockFile,
      slides: [],
      currentSlideIndex: 0,
      targetLanguage: 'ja',
      setIsExtracting: jest.fn(),
      setExtractedData: jest.fn(),
      setSlides: jest.fn(),
      setError: jest.fn(),
      setIsTranslating: jest.fn(),
      setTranslationProgress: jest.fn(),
      setTranslationMessage: jest.fn(),
      setIsDownloading: jest.fn()
    };
    const { result } = renderHook(() => usePreviewOperations(mockProps));
    expect(result.current).toBeDefined();
  });
});

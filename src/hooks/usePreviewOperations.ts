import { useCallback } from 'react';
import { SlideData } from './usePreviewState';
import logger from '@/lib/logger';

interface FileRecord {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  status: 'processing' | 'completed' | 'failed';
  file_url?: string;
  metadata?: any;
  error?: string;
}

interface UsePreviewOperationsProps {
  file: FileRecord;
  slides: SlideData[];
  currentSlideIndex: number;
  targetLanguage: string;
  setIsExtracting: (value: boolean) => void;
  setExtractedData: (data: any) => void;
  setSlides: (slides: SlideData[] | ((prev: SlideData[]) => SlideData[])) => void;
  setError: (error: string | null) => void;
  setIsTranslating: (value: boolean) => void;
  setTranslationProgress: (value: number) => void;
  setTranslationMessage: (message: string) => void;
  setIsDownloading: (value: boolean) => void;
}

export function usePreviewOperations({
  file,
  slides,
  currentSlideIndex,
  targetLanguage,
  setIsExtracting,
  setExtractedData,
  setSlides,
  setError,
  setIsTranslating,
  setTranslationProgress,
  setTranslationMessage,
  setIsDownloading
}: UsePreviewOperationsProps) {
  
  // テキスト抽出
  const extractTexts = useCallback(async () => {
    if (!file?.file_url) {
      setError('ファイルURLが見つかりません');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          fileUrl: file.file_url
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `抽出に失敗しました: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.slides && Array.isArray(data.slides)) {
        const processedSlides = data.slides.map((slide: any, index: number) => ({
          id: slide.id || `slide-${index}`,
          imageUrl: slide.imageUrl,
          title: slide.title,
          content: slide.content,
          texts: slide.texts || [],
          notes: slide.notes
        }));

        setExtractedData(data);
        setSlides(processedSlides);
      } else {
        throw new Error('スライドデータの形式が不正です');
      }
    } catch (error) {
      logger.error('Extraction error:', error);
      setError(error instanceof Error ? error.message : 'テキスト抽出中にエラーが発生しました');
    } finally {
      setIsExtracting(false);
    }
  }, [file, setIsExtracting, setExtractedData, setSlides, setError]);

  // 翻訳処理
  const handleTranslate = useCallback(async (allSlides: boolean = false) => {
    setIsTranslating(true);
    setTranslationProgress(0);
    setTranslationMessage('翻訳を開始しています...');
    setError(null);

    try {
      const slidesToTranslate = allSlides ? slides : [slides[currentSlideIndex]];
      const totalTexts = slidesToTranslate.reduce(
        (sum, slide) => sum + slide.texts.length, 0
      );
      let processedTexts = 0;

      const translatedSlides = await Promise.all(
        slidesToTranslate.map(async (slide) => {
          const translatedTexts = await Promise.all(
            slide.texts.map(async (text) => {
              if (text.translated) {
                processedTexts++;
                setTranslationProgress((processedTexts / totalTexts) * 100);
                return text;
              }

              try {
                setTranslationMessage(`テキストを翻訳中 (${processedTexts + 1}/${totalTexts})`);
                
                const response = await fetch('/api/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: text.original,
                    targetLang: targetLanguage
                  })
                });

                if (!response.ok) {
                  throw new Error(`翻訳に失敗しました: ${response.status}`);
                }

                const result = await response.json();
                processedTexts++;
                setTranslationProgress((processedTexts / totalTexts) * 100);
                
                return {
                  ...text,
                  translated: result.translatedText
                };
              } catch (error) {
                logger.error('Translation error for text:', error);
                processedTexts++;
                setTranslationProgress((processedTexts / totalTexts) * 100);
                return text;
              }
            })
          );

          return {
            ...slide,
            texts: translatedTexts
          };
        })
      );

      if (allSlides) {
        setSlides(translatedSlides);
      } else {
        setSlides((prevSlides: SlideData[]) => 
          prevSlides.map((slide: SlideData, index: number) => 
            index === currentSlideIndex ? translatedSlides[0] : slide
          )
        );
      }

      setTranslationMessage('翻訳が完了しました！');
      setTimeout(() => setTranslationMessage(''), 3000);
    } catch (error) {
      logger.error('Translation error:', error);
      setError(error instanceof Error ? error.message : '翻訳中にエラーが発生しました');
    } finally {
      setIsTranslating(false);
      setTranslationProgress(0);
    }
  }, [slides, currentSlideIndex, targetLanguage, setIsTranslating, setTranslationProgress, setTranslationMessage, setSlides, setError]);

  // ダウンロード処理
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setError(null);

    try {
      const response = await fetch('/api/apply-translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          fileUrl: file.file_url,
          slides: slides
        })
      });

      if (!response.ok) {
        throw new Error(`ダウンロードに失敗しました: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.(pptx?|ppt)$/i, '_translated.pptx');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('Download error:', error);
      setError(error instanceof Error ? error.message : 'ダウンロード中にエラーが発生しました');
    } finally {
      setIsDownloading(false);
    }
  }, [file, slides, setIsDownloading, setError]);

  return {
    extractTexts,
    handleTranslate,
    handleDownload
  };
}
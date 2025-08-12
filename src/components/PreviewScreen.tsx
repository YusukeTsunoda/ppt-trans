'use client';

import { useState, useEffect } from 'react';
import type { ProcessingResult, SlideData } from '@/types';
import { getSettings } from '@/lib/settings';
import { updateHistoryItem } from '@/lib/history';
import { useResponsive } from '@/hooks/useResponsive';

// CSSアニメーションをグローバルスタイルとして追加
const globalStyles = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

interface PreviewScreenProps {
  data: ProcessingResult;
  onBack: () => void;
  onDataUpdate?: (updatedData: ProcessingResult) => void;
  historyId?: string | null;
}

export function PreviewScreen({ data, onBack, onDataUpdate, historyId }: PreviewScreenProps) {
  const responsive = useResponsive();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Japanese');
  const [slides, setSlides] = useState<SlideData[]>(data.slides);
  const [error, setError] = useState<string | null>(null);
  const [highlightedTextId, setHighlightedTextId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [translationProgress, setTranslationProgress] = useState({ current: 0, total: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const currentSlide = slides[currentSlideIndex];
  const hasTexts = currentSlide?.texts.length > 0;

  // キーボードナビゲーション
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentSlideIndex > 0) {
        setCurrentSlideIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentSlideIndex < slides.length - 1) {
        setCurrentSlideIndex(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlideIndex, slides.length]);

  // スライド切り替え時にズームとポジションをリセット
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setHighlightedTextId(null);
  }, [currentSlideIndex]);

  const handleTranslate = async (allSlides: boolean = false) => {
    setIsTranslating(true);
    setError(null);

    try {
      const settings = getSettings();
      // 翻訳するテキストを収集
      const textsToTranslate = allSlides 
        ? slides.flatMap(slide => 
            slide.texts.map(text => ({
              id: text.id,
              original: text.original,
              slideIndex: slides.indexOf(slide)
            }))
          )
        : currentSlide.texts.map(text => ({
            id: text.id,
            original: text.original,
            slideIndex: currentSlideIndex
          }));

      if (textsToTranslate.length === 0) {
        setError('翻訳するテキストがありません。');
        return;
      }

      // 進捗状況を初期化
      setTranslationProgress({ current: 0, total: textsToTranslate.length });

      // バッチサイズを設定（一度に翻訳するテキスト数）
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        batches.push(textsToTranslate.slice(i, i + batchSize));
      }

      const allTranslations: { id: string; translated: string }[] = [];
      
      // バッチごとに翻訳を実行
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // API Route経由で翻訳
        const response = await fetch('/api/translate/batch-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: batch,
            sourceLanguage: 'auto', // 自動検出
            targetLanguage: targetLanguage,
            model: settings.translationModel
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || '翻訳に失敗しました。');
        }

        allTranslations.push(...result.translations);
        
        // 進捗状況を更新
        setTranslationProgress(prev => ({
          ...prev,
          current: Math.min(prev.current + batch.length, prev.total)
        }));
      }

      // 翻訳結果を反映
      const updatedSlides = [...slides];
      
      if (allSlides) {
        // 全スライドの翻訳を反映
        updatedSlides.forEach((slide, slideIndex) => {
          updatedSlides[slideIndex] = {
            ...slide,
            texts: slide.texts.map(text => {
              const translation = allTranslations.find((t: { id: string; translated: string }) => t.id === text.id);
              return {
                ...text,
                translated: translation ? translation.translated : text.translated
              };
            })
          };
        });
      } else {
        // 現在のスライドのみ翻訳を反映
        updatedSlides[currentSlideIndex] = {
          ...currentSlide,
          texts: currentSlide.texts.map(text => {
            const translation = allTranslations.find((t: { id: string; translated: string }) => t.id === text.id);
            return {
              ...text,
              translated: translation ? translation.translated : text.translated
            };
          })
        };
      }

      setSlides(updatedSlides);
      
      // 親コンポーネントにデータを更新
      if (onDataUpdate) {
        onDataUpdate({
          slides: updatedSlides,
          totalSlides: updatedSlides.length
        });
      }

    } catch (err) {
      console.error('Translation error:', err);
      const errorMessage = err instanceof Error ? err.message : '翻訳中にエラーが発生しました。';
      setError(errorMessage);
    } finally {
      setIsTranslating(false);
      setTranslationProgress({ current: 0, total: 0 });
    }
  };

  const handleTextClick = (textId: string) => {
    setHighlightedTextId(textId);
    // Clear highlight after 5 seconds
    setTimeout(() => setHighlightedTextId(null), 5000);
  };

  const handleStartEdit = (textId: string, currentText: string) => {
    setEditingTextId(textId);
    setEditingText(currentText || '');
  };

  const handleSaveEdit = () => {
    if (editingTextId) {
      const updatedSlides = [...slides];
      const slideIndex = currentSlideIndex;
      const textIndex = updatedSlides[slideIndex].texts.findIndex(t => t.id === editingTextId);
      
      if (textIndex !== -1) {
        updatedSlides[slideIndex].texts[textIndex].translated = editingText;
        setSlides(updatedSlides);
        
        // 親コンポーネントにデータを更新
        if (onDataUpdate) {
          onDataUpdate({
            slides: updatedSlides,
            totalSlides: updatedSlides.length
          });
        }
      }
      
      setEditingTextId(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingTextId(null);
    setEditingText('');
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // 各スライドから元のファイルURLを取得（すべて同じURLのはず）
      const originalFileUrl = slides[0]?.originalFileUrl;
      
      if (!originalFileUrl) {
        setError('元のファイル情報が見つかりません。ファイルを再度アップロードしてください。');
        setIsDownloading(false);
        return;
      }

      // Server Actionに送信するデータを準備
      const requestData = {
        originalFileUrl,
        editedSlides: slides.map(slide => ({
          pageNumber: slide.pageNumber,
          texts: slide.texts.map(text => ({
            id: text.id,
            original: text.original,
            translated: text.translated || text.original // 翻訳がない場合は元のテキストを使用
          }))
        }))
      };

      console.log('Generating translated PPTX...', requestData);

      // API Route経由でPPTXファイルを生成
      const response = await fetch('/api/generate/pptx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'PPTXファイルの生成に失敗しました');
      }

      console.log('PPTX generation result:', result);

      // ダウンロード処理
      if (result.downloadUrl) {
        try {
          const fileResponse = await fetch(result.downloadUrl);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'translated_presentation.pptx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // 履歴を更新（ダウンロード完了）
            if (historyId) {
              updateHistoryItem(historyId, {
                status: 'downloaded',
                translatedFileUrl: result.downloadUrl,
              });
            }
            
            // 成功通知
            alert('翻訳版のPPTXファイルをダウンロードしました！');
            return;
          }
        } catch (corsError) {
          console.log('Direct download failed, trying fallback method...', corsError);
        }
        
        // CORS エラーの場合はリンククリックでダウンロード
        const downloadLink = document.createElement('a');
        downloadLink.href = result.downloadUrl;
        downloadLink.download = 'translated_presentation.pptx';
        downloadLink.target = '_blank';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 履歴を更新（ダウンロード完了）
        if (historyId) {
          updateHistoryItem(historyId, {
            status: 'downloaded',
            translatedFileUrl: result.downloadUrl,
          });
        }
        
        alert('翻訳版のPPTXファイルをダウンロードしました！');
      } else {
        throw new Error('ダウンロードURLが取得できませんでした');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      setError(`ダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* ヘッダー */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm mb-4 p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2 transition-all duration-200 hover:shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                プレビュー & 翻訳
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                disabled={isTranslating}
              >
                <option value="Japanese">日本語</option>
                <option value="English">英語</option>
                <option value="Chinese">中国語</option>
                <option value="Korean">韓国語</option>
                <option value="Spanish">スペイン語</option>
                <option value="French">フランス語</option>
                <option value="German">ドイツ語</option>
              </select>
              <button
                onClick={() => handleTranslate(false)}
                disabled={isTranslating || !hasTexts}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 hover:shadow-md"
              >
                {isTranslating ? (
                  <>
                    <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                    翻訳中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    現在のスライドを翻訳
                  </>
                )}
              </button>
              <button
                onClick={() => handleTranslate(true)}
                disabled={isTranslating}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                すべて翻訳
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-2 transition-all duration-200 hover:shadow-md"
              >
                {isDownloading ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                    生成中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    翻訳版をダウンロード
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* サムネイル一覧 - ヘッダー下に配置 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-4 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">すべてのスライド</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.pageNumber}
                onClick={() => setCurrentSlideIndex(index)}
                className={`relative flex-shrink-0 transition-all duration-200 ${
                  index === currentSlideIndex ? 'ring-2 ring-blue-500 rounded-lg shadow-md' : 'hover:shadow-sm'
                }`}
              >
                <div className="w-32 h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${slide.pageNumber}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1 rounded-b-lg">
                  <p className="text-white text-xs font-medium">
                    {slide.pageNumber}
                  </p>
                </div>
                {slide.texts.some(t => t.translated) && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 翻訳進捗表示 */}
        {isTranslating && translationProgress.total > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                <p className="text-blue-700 font-medium">
                  翻訳中... {translationProgress.current} / {translationProgress.total} 件
                </p>
              </div>
              <span className="text-blue-600 font-bold">
                {Math.round((translationProgress.current / translationProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(translationProgress.current / translationProgress.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              予想残り時間: 約{Math.ceil((translationProgress.total - translationProgress.current) * 2)}秒
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* メインコンテンツ - 中央配置の大きなスライド */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 md:p-6 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                スライド {currentSlide?.pageNumber} / {slides.length}
              </h2>
              <div className="flex gap-2">
                {/* ズームコントロール */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 text-slate-700 hover:bg-slate-200 rounded transition-all duration-200"
                    title="縮小"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  <span className="text-sm font-medium text-slate-700 min-w-[50px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    className="p-2 text-slate-700 hover:bg-slate-200 rounded transition-all duration-200"
                    title="拡大"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2 text-slate-700 hover:bg-slate-200 rounded transition-all duration-200"
                    title="リセット"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                
                {/* ナビゲーションボタン */}
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentSlideIndex === 0}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  前へ
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                  disabled={currentSlideIndex === slides.length - 1}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all duration-200"
                >
                  次へ
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* スライド画像 - より大きく表示 */}
            <div 
              className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-5xl mx-auto shadow-inner relative"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              {currentSlide && (
                <div
                  className="w-full h-full relative"
                  style={{
                    transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                  }}
                >
                  {/* 画像コンテナ - position: relativeで親要素として機能 */}
                  <div className="w-full h-full relative flex items-center justify-center">
                    {/* 画像を中央配置のコンテナ内に配置 */}
                    <div className="relative" style={{ width: '100%', height: '100%' }}>
                      <img
                        src={currentSlide.imageUrl}
                        alt={`Slide ${currentSlide.pageNumber}`}
                        className="w-full h-full object-contain select-none"
                        loading="eager"
                        draggable={false}
                      />
                      {/* ハイライトオーバーレイ - 画像の実際の表示領域に対して配置 */}
                      {highlightedTextId && currentSlide.texts.map((text) => {
                        if (text.id !== highlightedTextId) return null;
                        
                        // デバッグ用ログ
                        console.log('Highlighting text:', text.id, 'Position:', text.position);
                        
                        // PowerPointのデフォルトスライドサイズ（ポイント単位）
                        // 標準的な16:9スライド: 幅960pt x 高さ540pt
                        // Pythonから取得した座標もポイント単位なので、この値で正規化
                        const slideWidthPt = 960;
                        const slideHeightPt = 540;
                        
                        // 位置をパーセンテージに変換（ポイント単位の座標を基準に）
                        const left = (text.position.x / slideWidthPt) * 100;
                        const top = (text.position.y / slideHeightPt) * 100;
                        const width = (text.position.width / slideWidthPt) * 100;
                        const height = (text.position.height / slideHeightPt) * 100;
                        
                        return (
                          <div
                            key={text.id}
                            className="absolute pointer-events-none"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: `${width}%`,
                              height: `${height}%`,
                              border: '3px solid #3B82F6',
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              borderRadius: '8px',
                              zIndex: 10,
                              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ページネーション */}
            <div className="mt-4 flex justify-center gap-1 flex-wrap">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`w-8 h-8 text-xs rounded-lg transition-all duration-200 ${
                    index === currentSlideIndex
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* テキストペア表示 - スライド下に配置 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 md:p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            テキスト内容 ({currentSlide?.texts.length || 0} 項目)
          </h2>
          
          {hasTexts ? (
            <>
              {/* ヘッダー */}
              <div className={`grid ${responsive.isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'} gap-4 lg:gap-6 mb-4 border-b border-slate-200 dark:border-slate-700 pb-3`}>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                    原文
                  </h3>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-600 rounded-full"></span>
                    翻訳
                  </h3>
                </div>
              </div>

              {/* スクロール可能なコンテンツ */}
              <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-slate-100 dark:scrollbar-track-slate-800">
                <div className="space-y-4">
                  {currentSlide.texts.map((text, index) => (
                    <div key={text.id} className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                      {/* 原文 */}
                      <div 
                        onClick={() => handleTextClick(text.id)}
                        className={`border rounded-lg p-4 hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer ${
                          highlightedTextId === text.id ? 'border-blue-500 shadow-lg bg-blue-50 dark:bg-blue-900/20' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        title="クリックして位置を表示"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-slate-900 dark:text-slate-100 leading-relaxed select-text">
                              {text.original}
                            </p>
                            {text.type === 'table_cell' && (
                              <span className="text-xs text-blue-600 mt-1 inline-flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                表のセル
                              </span>
                            )}
                            {highlightedTextId === text.id && (
                              <span className="text-xs text-blue-600 mt-1 inline-flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                位置をハイライト中
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 翻訳文 */}
                      <div 
                        className={`border rounded-lg p-4 hover:shadow-md transition-all duration-200 ${
                          highlightedTextId === text.id 
                            ? 'border-blue-500 shadow-lg' 
                            : text.translated 
                              ? 'border-emerald-200 dark:border-emerald-700 hover:border-emerald-300 dark:hover:border-emerald-600' 
                              : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        } ${
                          highlightedTextId === text.id 
                            ? 'bg-blue-50 dark:bg-blue-900/20' 
                            : text.translated 
                              ? 'bg-emerald-50 dark:bg-emerald-900/10' 
                              : 'bg-white dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => handleTextClick(text.id)}
                            className={`flex-shrink-0 w-8 h-8 text-white rounded-lg flex items-center justify-center text-sm font-bold shadow-sm cursor-pointer hover:opacity-90 transition-opacity ${
                              text.translated ? 'bg-emerald-600' : 'bg-slate-400'
                            }`}
                            title="クリックして位置を表示"
                          >
                            {index + 1}
                          </button>
                          <div className="flex-1">
                            {editingTextId === text.id ? (
                              // 編集モード
                              <div className="space-y-2">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  rows={3}
                                  autoFocus
                                  placeholder="翻訳文を入力..."
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium"
                                  >
                                    保存
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="px-3 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // 表示モード
                              <>
                                {text.translated ? (
                                  <>
                                    <p className="text-slate-900 dark:text-slate-100 leading-relaxed select-text">
                                      {text.translated}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 font-medium">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        翻訳済み
                                      </span>
                                      <button
                                        onClick={() => handleStartEdit(text.id, text.translated)}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1 font-medium transition-colors"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        編集
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div>
                                    <p className="text-slate-400 dark:text-slate-500 italic">
                                      未翻訳
                                    </p>
                                    <button
                                      onClick={() => handleStartEdit(text.id, '')}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1 font-medium mt-2 transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      翻訳を追加
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">テキストが検出されませんでした</p>
              <p className="text-sm mt-1">このスライドには抽出可能なテキストが含まれていません</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
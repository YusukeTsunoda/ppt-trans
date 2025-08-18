'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import logger from '@/lib/logger';

interface ExtractedData {
  success: boolean;
  total_slides: number;
  slides: Array<{
    slide_number: number;
    texts: Array<{
      text?: string;
      table?: string[][];  // テーブルデータ用の型を追加
      shape_type?: string;
      position?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  }>;
}

interface FileRecord {
  id: string;
  filename: string;
  original_name: string;
  file_size: number;
  status: string;
  file_path?: string;
  extracted_data?: ExtractedData;
  created_at: string;
}

interface SlideData {
  pageNumber: number;
  imageUrl?: string;
  texts: Array<{
    id: string;
    original: string;
    translated?: string;
    position?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    type?: string;
  }>;
}

interface PreviewViewProps {
  file: FileRecord;
}

export default function PreviewView({ file }: PreviewViewProps) {
  const router = useRouter();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('ja');
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  
  // ズーム・パン関連の状態
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // ファイルからテキストを抽出
  const extractText = async () => {
    setIsExtracting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          filePath: file.filename || file.file_path,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'テキスト抽出に失敗しました');
      }
      
      setExtractedData(result.data);
      
      // スライドデータを整形
      const formattedSlides: SlideData[] = result.data.slides.map((slide: ExtractedData['slides'][0]) => ({
        pageNumber: slide.slide_number,
        // MVPとしてプレースホルダー画像を使用
        // TODO: 将来的には実際のスライド画像を生成
        imageUrl: `https://via.placeholder.com/1280x720/f8f9fa/6c757d?text=Slide+${slide.slide_number}`,
        texts: slide.texts.map((text: ExtractedData['slides'][0]['texts'][0], index: number) => {
          let originalText = '';
          
          if (typeof text === 'string') {
            originalText = text;
          } else if (text.text) {
            originalText = text.text;
          } else if (text.table) {
            // テーブルデータを文字列に変換
            originalText = text.table.map((row: string[]) => row.join('\t')).join('\n');
          }
          
          return {
            id: `${slide.slide_number}-${index}`,
            original: originalText,
            type: text.shape_type || 'text',
            position: text.position || undefined,
          };
        }),
      }));
      
      setSlides(formattedSlides);
      
      // データベースに保存
      const supabase = createClient();
      await supabase
        .from('files')
        .update({
          extracted_data: result.data,
          status: 'processed',
        })
        .eq('id', file.id);
        
    } catch (err) {
      logger.error('Extraction error:', err);
      setError(err instanceof Error ? err.message : 'テキスト抽出中にエラーが発生しました');
    } finally {
      setIsExtracting(false);
    }
  };
  
  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // プラス/マイナスキーでズーム
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleZoomReset();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // 初回読み込み時に既存のデータをチェック
  useEffect(() => {
    if (file.extracted_data) {
      setExtractedData(file.extracted_data);
      
      // スライドデータを整形
      const formattedSlides: SlideData[] = file.extracted_data.slides.map((slide: ExtractedData['slides'][0]) => ({
        pageNumber: slide.slide_number,
        // MVPとしてプレースホルダー画像を使用
        // TODO: 将来的には実際のスライド画像を生成
        imageUrl: `https://via.placeholder.com/1280x720/f8f9fa/6c757d?text=Slide+${slide.slide_number}`,
        texts: slide.texts.map((text: ExtractedData['slides'][0]['texts'][0], index: number) => {
          let originalText = '';
          
          if (typeof text === 'string') {
            originalText = text;
          } else if (text.text) {
            originalText = text.text;
          } else if (text.table) {
            // テーブルデータを文字列に変換
            originalText = text.table.map((row: string[]) => row.join('\t')).join('\n');
          }
          
          return {
            id: `${slide.slide_number}-${index}`,
            original: originalText,
            type: text.shape_type || 'text',
            position: text.position || undefined,
          };
        }),
      }));
      
      setSlides(formattedSlides);
    } else {
      // データがない場合は自動で抽出
      extractText();
    }
  }, [file]);
  
  // 翻訳処理
  const handleTranslate = async (allSlides: boolean = false) => {
    setIsTranslating(true);
    setError(null);
    
    try {
      const textsToTranslate = allSlides 
        ? slides.flatMap(slide => 
            slide.texts.map(text => ({
              id: text.id,
              text: text.original,
            }))
          )
        : slides[currentSlideIndex].texts.map(text => ({
            id: text.id,
            text: text.original,
          }));
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: textsToTranslate,
          targetLanguage,
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '翻訳に失敗しました');
      }
      
      // 翻訳結果を反映
      const updatedSlides = [...slides];
      result.translations.forEach((translation: { id: string; original: string; translated: string }) => {
        const [slideNum, textIndex] = translation.id.split('-').map(Number);
        const slideIndex = slideNum - 1;
        if (updatedSlides[slideIndex] && updatedSlides[slideIndex].texts[textIndex]) {
          updatedSlides[slideIndex].texts[textIndex].translated = translation.translated;
        }
      });
      
      setSlides(updatedSlides);
      
    } catch (err) {
      logger.error('Translation error:', err);
      setError(err instanceof Error ? err.message : '翻訳中にエラーが発生しました');
    } finally {
      setIsTranslating(false);
    }
  };
  
  const currentSlide = slides[currentSlideIndex];
  
  // テキストを位置情報に基づいてソート（左上から右下へ）
  const sortedTexts = currentSlide?.texts ? [...currentSlide.texts].sort((a, b) => {
    // 位置情報がない場合は元の順序を保持
    if (!a.position || !b.position) {
      return 0;
    }
    
    // まずY座標（上から下）でソート
    const yDiff = a.position.y - b.position.y;
    
    // Y座標の差が50px以内なら同じ行とみなしてX座標でソート
    if (Math.abs(yDiff) < 50) {
      return a.position.x - b.position.x;
    }
    
    return yDiff;
  }) : [];
  
  // ズーム関連のハンドラー
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  };
  
  const handleZoomReset = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };
  
  // ドラッグ関連のハンドラー
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) { // 左クリックのみ
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
    }
  };
  
  // 翻訳文の編集開始
  const startEditingTranslation = (textId: string, currentTranslation: string) => {
    setEditingTextId(textId);
    setEditingText(currentTranslation || '');
  };
  
  // 翻訳文の編集保存
  const saveEditedTranslation = (textId: string) => {
    const updatedSlides = [...slides];
    const slideIndex = currentSlideIndex;
    const textIndex = updatedSlides[slideIndex].texts.findIndex(t => t.id === textId);
    
    if (textIndex !== -1) {
      updatedSlides[slideIndex].texts[textIndex].translated = editingText;
      setSlides(updatedSlides);
    }
    
    setEditingTextId(null);
    setEditingText('');
  };
  
  // 編集のキャンセル
  const cancelEditing = () => {
    setEditingTextId(null);
    setEditingText('');
  };
  
  // 翻訳済みPowerPointのダウンロード
  const downloadTranslatedPPTX = async () => {
    setIsDownloading(true);
    setError(null);
    
    try {
      // すべてのスライドの翻訳データを整形
      const translationsData = {
        slides: slides.map(slide => ({
          slide_number: slide.pageNumber,
          texts: slide.texts.map(text => ({
            original: text.original,
            translated: text.translated || text.original,
            isTable: text.type === 'TABLE'
          }))
        }))
      };
      
      const response = await fetch('/api/apply-translations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          filePath: file.filename || file.file_path,
          translations: translationsData
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '翻訳済みファイルの生成に失敗しました');
      }
      
      // ダウンロードリンクを作成してクリック
      if (result.dataUri) {
        const link = document.createElement('a');
        link.href = result.dataUri;
        link.download = result.fileName || 'translated_presentation.pptx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 成功メッセージを表示（一時的）
        const tempMessage = `${result.message || 'ファイルのダウンロードを開始しました'}`;
        setError(null);
        // 成功トーストなどを表示する場合はここに追加
        logger.info('Download started:', { fileName: result.fileName, appliedCount: result.appliedCount });
      } else if (result.downloadUrl) {
        // 互換性のため古い形式もサポート
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = result.fileName || 'translated_presentation.pptx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logger.info('Download started:', { fileName: result.fileName, appliedCount: result.appliedCount });
      }
    } catch (err) {
      logger.error('Download error:', err);
      setError(err instanceof Error ? err.message : 'ダウンロード中にエラーが発生しました');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← ダッシュボードに戻る
              </Link>
              <h1 className="text-2xl font-bold">
                {file.original_name} - プレビュー
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="px-3 py-2 border rounded-lg"
                disabled={isTranslating}
              >
                <option value="ja">日本語</option>
                <option value="en">英語</option>
                <option value="zh">中国語</option>
                <option value="ko">韓国語</option>
              </select>
              <button
                onClick={() => handleTranslate(false)}
                disabled={isTranslating || !currentSlide}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isTranslating ? '翻訳中...' : '現在のスライドを翻訳'}
              </button>
              <button
                onClick={() => handleTranslate(true)}
                disabled={isTranslating || slides.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                すべて翻訳
              </button>
              
              {/* ダウンロードボタン */}
              <div className="border-l pl-3 ml-3">
                <button
                  onClick={downloadTranslatedPPTX}
                  disabled={isDownloading || slides.length === 0 || !slides.some(s => s.texts.some(t => t.translated))}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  title="翻訳済みのPowerPointファイルをダウンロード"
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>生成中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>翻訳済みをダウンロード</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {/* ローディング */}
        {isExtracting && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">PowerPointファイルからテキストを抽出中...</p>
          </div>
        )}
        
        {/* メインコンテンツ */}
        {!isExtracting && slides.length > 0 && (
          <>
            {/* MVP説明メッセージ */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    <strong>お知らせ：</strong> 現在、スライドのプレビュー画像は準備中です。
                    今後のアップデートで実際のスライド画像が表示されるようになります。
                    現在はテキスト内容の確認と翻訳機能をご利用いただけます。
                  </p>
                </div>
              </div>
            </div>
            
            {/* スライドナビゲーション */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  スライド {currentSlide?.pageNumber} / {slides.length}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1));
                      setSelectedTextId(null); // スライド変更時に選択をリセット
                      handleZoomReset(); // ズームと位置をリセット
                    }}
                    disabled={currentSlideIndex === 0}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => {
                      setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1));
                      setSelectedTextId(null); // スライド変更時に選択をリセット
                      handleZoomReset(); // ズームと位置をリセット
                    }}
                    disabled={currentSlideIndex === slides.length - 1}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    次へ
                  </button>
                </div>
              </div>
              
              {/* サムネイル一覧 */}
              <div className="flex gap-2 overflow-x-auto py-2">
                {slides.map((slide, index) => (
                  <button
                    key={slide.pageNumber}
                    onClick={() => {
                      setCurrentSlideIndex(index);
                      setSelectedTextId(null); // スライド変更時に選択をリセット
                      handleZoomReset(); // ズームと位置をリセット
                    }}
                    className={`flex-shrink-0 p-2 rounded-lg border-2 transition-all ${
                      index === currentSlideIndex 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      スライド {slide.pageNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {slide.texts.length} テキスト
                    </div>
                    {slide.texts.some(t => t.translated) && (
                      <div className="text-xs text-green-600 mt-1">✓ 翻訳済み</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* スライドプレビュー（プレースホルダー） */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">スライドプレビュー</h3>
                
                {/* ズームコントロール */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="ズームアウト"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  
                  <span className="px-3 py-1 bg-gray-100 rounded-lg text-sm font-medium min-w-[80px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="ズームイン"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={handleZoomReset}
                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    title="リセット"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  <div className="ml-2 text-xs text-gray-500">
                    Ctrl + スクロール or ドラッグで移動
                  </div>
                </div>
              </div>
              
              <div 
                className="relative bg-gray-100 rounded-lg overflow-hidden select-none" 
                style={{ 
                  aspectRatio: '16/9',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                  }}
                >
                  {currentSlide?.imageUrl && (
                    <>
                      <img 
                        src={currentSlide.imageUrl} 
                        alt={`スライド ${currentSlide.pageNumber}`}
                        className="max-w-full max-h-full"
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-white rounded-lg p-4 max-w-sm text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-gray-600">
                            スライドプレビューは準備中です
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            次回アップデートで追加予定
                          </p>
                        </div>
                      </div>
                      
                      {/* テキスト位置のハイライトオーバーレイ */}
                      {selectedTextId && currentSlide.texts.map((text) => {
                        if (text.id !== selectedTextId || !text.position) return null;
                        
                        // プレースホルダー画像のサイズに基づいた仮の位置計算
                        // 実際のスライドサイズ（1280x720）に対する相対位置として扱う
                        const scaleX = 100 / 1280; // パーセンテージに変換
                        const scaleY = 100 / 720;
                        
                        return (
                          <div
                            key={`highlight-${text.id}`}
                            className="absolute border-4 border-yellow-400 bg-yellow-200 bg-opacity-30 rounded-lg animate-pulse pointer-events-none"
                            style={{
                              left: `${text.position.x * scaleX}%`,
                              top: `${text.position.y * scaleY}%`,
                              width: `${text.position.width * scaleX}%`,
                              height: `${text.position.height * scaleY}%`,
                            }}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* テキスト内容 */}
            <div className="bg-white rounded-lg shadow-sm" data-testid="preview-container">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  テキスト内容 ({currentSlide?.texts.length || 0} 項目)
                </h3>
              </div>
              
              {sortedTexts.length > 0 ? (
                <div 
                  className="p-6 space-y-4 overflow-y-auto custom-scrollbar"
                  style={{ 
                    maxHeight: '500px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#CBD5E0 #F7FAFC'
                  }}
                >
                  {sortedTexts.map((text, index) => (
                    <div 
                      key={text.id} 
                      className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                        selectedTextId === text.id ? 'border-yellow-400 bg-yellow-50' : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div 
                          className="cursor-pointer"
                          onClick={() => setSelectedTextId(selectedTextId === text.id ? null : text.id)}
                        >
                          <div className="text-sm font-medium text-gray-600 mb-1 flex items-center gap-2">
                            原文 {text.type && `(${text.type})`}
                            {text.position && (
                              <span className="text-xs text-gray-400">
                                ({Math.round(text.position.x)}, {Math.round(text.position.y)})
                              </span>
                            )}
                            {selectedTextId === text.id && (
                              <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                                ハイライト中
                              </span>
                            )}
                          </div>
                          <div className="text-gray-900 whitespace-pre-wrap" data-testid="slide-text">
                            {text.original}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1 flex items-center justify-between">
                            <span>翻訳</span>
                            {editingTextId !== text.id && text.translated && (
                              <button
                                onClick={() => startEditingTranslation(text.id, text.translated || '')}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                              >
                                編集
                              </button>
                            )}
                          </div>
                          {editingTextId === text.id ? (
                            <div>
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="w-full p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => saveEditedTranslation(text.id)}
                                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                >
                                  保存
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                                >
                                  キャンセル
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className={`whitespace-pre-wrap ${
                                text.translated ? 'text-gray-900' : 'text-gray-400 italic'
                              }`} 
                              data-testid={text.translated ? "translated-text" : "untranslated-text"}
                              onDoubleClick={() => text.translated && startEditingTranslation(text.id, text.translated)}
                              title={text.translated ? "ダブルクリックで編集" : ""}
                              style={{ cursor: text.translated ? 'text' : 'default' }}
                            >
                              {text.translated || '未翻訳'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <p className="text-gray-500 text-center py-8">
                    このスライドにはテキストが含まれていません
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* データがない場合 */}
        {!isExtracting && slides.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">テキストデータがありません</p>
            <button
              onClick={extractText}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              テキストを抽出
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
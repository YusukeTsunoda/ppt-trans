'use client';

import { useState, useEffect } from 'react';
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
        texts: slide.texts.map((text: ExtractedData['slides'][0]['texts'][0], index: number) => ({
          id: `${slide.slide_number}-${index}`,
          original: typeof text === 'string' ? text : text.text || '',
          type: text.shape_type || 'text',
          position: text.position || undefined,
        })),
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
  
  // 初回読み込み時に既存のデータをチェック
  useEffect(() => {
    if (file.extracted_data) {
      setExtractedData(file.extracted_data);
      
      // スライドデータを整形
      const formattedSlides: SlideData[] = file.extracted_data.slides.map((slide: ExtractedData['slides'][0]) => ({
        pageNumber: slide.slide_number,
        texts: slide.texts.map((text: ExtractedData['slides'][0]['texts'][0], index: number) => ({
          id: `${slide.slide_number}-${index}`,
          original: typeof text === 'string' ? text : text.text || '',
          type: text.shape_type || 'text',
          position: text.position || undefined,
        })),
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
            {/* スライドナビゲーション */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  スライド {currentSlide?.pageNumber} / {slides.length}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                    disabled={currentSlideIndex === 0}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
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
                    onClick={() => setCurrentSlideIndex(index)}
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
            
            {/* テキスト内容 */}
            <div className="bg-white rounded-lg shadow-sm p-6" data-testid="preview-container">
              <h3 className="text-lg font-semibold mb-4">
                テキスト内容 ({currentSlide?.texts.length || 0} 項目)
              </h3>
              
              {currentSlide && currentSlide.texts.length > 0 ? (
                <div className="space-y-4">
                  {currentSlide.texts.map((text, index) => (
                    <div key={text.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1">
                            原文 {text.type && `(${text.type})`}
                          </div>
                          <div className="text-gray-900 whitespace-pre-wrap" data-testid="slide-text">
                            {text.original}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1">
                            翻訳
                          </div>
                          <div className={`whitespace-pre-wrap ${
                            text.translated ? 'text-gray-900' : 'text-gray-400 italic'
                          }`} data-testid={text.translated ? "translated-text" : "untranslated-text"}>
                            {text.translated || '未翻訳'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  このスライドにはテキストが含まれていません
                </p>
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
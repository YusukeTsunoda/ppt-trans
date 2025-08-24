'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import logger from '@/lib/logger';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageToggle } from '@/components/LanguageToggle';

interface ExtractedData {
  success: boolean;
  total_slides: number;
  slides: Array<{
    slide_number: number;
    texts: Array<{
      text?: string;
      table?: string[][];  // 旧フォーマット（互換性のため残す）
      shape_type?: string;
      position?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      // 新しいテーブル形式
      table_info?: {
        rows: number;
        cols: number;
        position: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      };
      cells?: Array<{
        text: string;
        row: number;
        col: number;
        position: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
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
    tableInfo?: {
      row: number;
      col: number;
      totalRows?: number;
      totalCols?: number;
    };
  }>;
}

interface PreviewViewProps {
  file: FileRecord;
}

export default function PreviewView({ file }: PreviewViewProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  // 実際の進捗と表示用の進捗を分離
  const [realProgress, setRealProgress] = useState(0);           // 実際の翻訳進捗
  const [displayProgress, setDisplayProgress] = useState(0);      // 表示用の進捗（補間される）
  const [translationMessage, setTranslationMessage] = useState('');
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [translationStartTime, setTranslationStartTime] = useState<number | null>(null);
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
        throw new Error(result.error || t('extractionFailed') || 'テキスト抽出に失敗しました');
      }
      
      setExtractedData(result.data);
      
      // スライドデータを整形
      const formattedSlides: SlideData[] = result.data.slides.map((slide: ExtractedData['slides'][0]) => {
        const texts: any[] = [];
        let textIndex = 0;
        
        slide.texts.forEach((text: ExtractedData['slides'][0]['texts'][0]) => {
          if (text.cells) {
            // 新しいテーブル形式：各セルを個別のテキストとして扱う
            text.cells.forEach((cell) => {
              texts.push({
                id: `${slide.slide_number}-${textIndex++}`,
                original: cell.text,
                type: 'TABLE_CELL',
                position: cell.position,
                tableInfo: {
                  row: cell.row,
                  col: cell.col,
                  totalRows: text.table_info?.rows,
                  totalCols: text.table_info?.cols,
                },
              });
            });
          } else if (text.table) {
            // 旧フォーマット（互換性のため）
            const tableText = text.table.map((row: string[]) => row.join('\t')).join('\n');
            texts.push({
              id: `${slide.slide_number}-${textIndex++}`,
              original: tableText,
              type: 'TABLE',
              position: text.position,
            });
          } else if (text.text) {
            // 通常のテキスト
            texts.push({
              id: `${slide.slide_number}-${textIndex++}`,
              original: text.text,
              type: text.shape_type || 'text',
              position: text.position,
            });
          }
        });
        
        return {
          pageNumber: slide.slide_number,
          imageUrl: `https://via.placeholder.com/1280x720/f8f9fa/6c757d?text=Slide+${slide.slide_number}`,
          texts,
        };
      });
      
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
      setError(err instanceof Error ? err.message : t('extractionError') || 'テキスト抽出中にエラーが発生しました');
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
      const formattedSlides: SlideData[] = file.extracted_data.slides.map((slide: ExtractedData['slides'][0]) => {
        const texts: any[] = [];
        let textIndex = 0;
        
        slide.texts.forEach((text: ExtractedData['slides'][0]['texts'][0]) => {
          if (text.cells) {
            // 新しいテーブル形式：各セルを個別のテキストとして扱う
            text.cells.forEach((cell) => {
              texts.push({
                id: `${slide.slide_number}-${textIndex++}`,
                original: cell.text,
                type: 'TABLE_CELL',
                position: cell.position,
                tableInfo: {
                  row: cell.row,
                  col: cell.col,
                  totalRows: text.table_info?.rows,
                  totalCols: text.table_info?.cols,
                },
              });
            });
          } else if (text.table) {
            // 旧フォーマット（互換性のため）
            const tableText = text.table.map((row: string[]) => row.join('\t')).join('\n');
            texts.push({
              id: `${slide.slide_number}-${textIndex++}`,
              original: tableText,
              type: 'TABLE',
              position: text.position,
            });
          } else if (text.text) {
            // 通常のテキスト
            texts.push({
              id: `${slide.slide_number}-${textIndex++}`,
              original: text.text,
              type: text.shape_type || 'text',
              position: text.position,
            });
          }
        });
        
        return {
          pageNumber: slide.slide_number,
          imageUrl: `https://via.placeholder.com/1280x720/f8f9fa/6c757d?text=Slide+${slide.slide_number}`,
          texts,
        };
      });
      
      setSlides(formattedSlides);
    } else {
      // データがない場合は自動で抽出
      extractText();
    }
  }, [file]);
  
  // プログレスバーのスムーズな補間アニメーション
  useEffect(() => {
    if (!isTranslating || realProgress === 0) {
      setDisplayProgress(0);
      return;
    }

    const animationInterval = setInterval(() => {
      setDisplayProgress(prevDisplay => {
        // 目標値との差分を計算
        const diff = realProgress - prevDisplay;
        
        // 差分が小さい場合は目標値に設定
        if (Math.abs(diff) < 0.5) {
          return realProgress;
        }
        
        // イージング関数による補間（加速度を考慮）
        const step = diff * 0.15; // 15%ずつ目標に近づく
        return prevDisplay + step;
      });
    }, 50); // 50msごとに更新（20fps）

    return () => clearInterval(animationInterval);
  }, [isTranslating, realProgress]);

  // 残り時間の推定計算
  useEffect(() => {
    if (isTranslating && translationStartTime && realProgress > 0) {
      const elapsedTime = Date.now() - translationStartTime;
      const estimatedTotalTime = (elapsedTime / realProgress) * 100;
      const remaining = Math.max(0, estimatedTotalTime - elapsedTime);
      setEstimatedTimeRemaining(Math.round(remaining / 1000)); // 秒単位
    }
  }, [isTranslating, translationStartTime, realProgress]);
  
  // 翻訳処理
  const handleTranslate = async (allSlides: boolean = false) => {
    setIsTranslating(true);
    setRealProgress(0);
    setDisplayProgress(0);
    setTranslationStartTime(Date.now());
    setEstimatedTimeRemaining(null);
    setTranslationMessage(t('preparingTranslation') || '翻訳を準備中...');
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
      
      const totalTexts = textsToTranslate.length;
      let translatedCount = 0;
      
      // バッチサイズを設定（一度に送信するテキスト数）
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        batches.push(textsToTranslate.slice(i, i + batchSize));
      }
      
      const allTranslations = [];
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const currentBatchStart = translatedCount + 1;
        const currentBatchEnd = Math.min(translatedCount + batch.length, totalTexts);
        
        // 現在処理中のバッチの情報を表示
        const progressBeforeTranslation = Math.round((translatedCount / totalTexts) * 100);
        // 最小進捗を5%に設定（0%だと何も起きていないように見える）
        const displayableProgress = Math.max(5, progressBeforeTranslation);
        setRealProgress(displayableProgress);
        
        // メッセージに残り時間を追加
        const messageBase = `${t('translating') || '翻訳中'}... (${currentBatchStart}-${currentBatchEnd}/${totalTexts})`;
        const messageWithTime = estimatedTimeRemaining 
          ? `${messageBase} - 残り約${estimatedTimeRemaining}秒`
          : messageBase;
        setTranslationMessage(messageWithTime);
        
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            texts: batch,
            targetLanguage,
          }),
        });
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || t('translationFailed') || '翻訳に失敗しました');
        }
        
        allTranslations.push(...result.translations);
        translatedCount += batch.length;
        
        // 翻訳完了後の進捗率を更新
        const progressAfterTranslation = Math.round((translatedCount / totalTexts) * 100);
        setRealProgress(progressAfterTranslation);
        
        // 処理速度の計算とフィードバック
        if (translationStartTime) {
          const elapsedSeconds = (Date.now() - translationStartTime) / 1000;
          const textsPerSecond = translatedCount / elapsedSeconds;
          logger.debug(`Translation speed: ${textsPerSecond.toFixed(2)} texts/second`);
        }
        
        // APIレート制限を考慮して、バッチ間に短いウェイトを入れる（最後のバッチ以外）
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒のウェイト
        }
      }
      
      // 翻訳結果を反映
      const updatedSlides = [...slides];
      allTranslations.forEach((translation: { id: string; original: string; translated: string }) => {
        const [slideNum, textIndex] = translation.id.split('-').map(Number);
        const slideIndex = slideNum - 1;
        if (updatedSlides[slideIndex] && updatedSlides[slideIndex].texts[textIndex]) {
          updatedSlides[slideIndex].texts[textIndex].translated = translation.translated;
        }
      });
      
      setSlides(updatedSlides);
      
      // 完了時は即座に100%にジャンプ
      setRealProgress(100);
      setDisplayProgress(100);
      setTranslationMessage(t('translationCompleted') || '翻訳が完了しました');
      
      // 完了アニメーション後にリセット
      setTimeout(() => {
        setTranslationMessage('');
        setRealProgress(0);
        setDisplayProgress(0);
        setTranslationStartTime(null);
        setEstimatedTimeRemaining(null);
      }, 3000);
      
    } catch (err) {
      logger.error('Translation error:', err);
      setError(err instanceof Error ? err.message : t('translationError') || '翻詳中にエラーが発生しました');
      setRealProgress(0);
      setDisplayProgress(0);
      setTranslationMessage('');
      setTranslationStartTime(null);
      setEstimatedTimeRemaining(null);
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
  
  // テーブルセルをグループ化して表示用に整理
  const groupTableCells = (texts: any[]) => {
    const grouped: any[] = [];
    const tableGroups = new Map();
    
    texts.forEach(text => {
      if (text.type === 'TABLE_CELL' && text.tableInfo) {
        const key = `${text.tableInfo.totalRows}-${text.tableInfo.totalCols}`;
        if (!tableGroups.has(key)) {
          tableGroups.set(key, {
            type: 'TABLE_GROUP',
            cells: [],
            totalRows: text.tableInfo.totalRows,
            totalCols: text.tableInfo.totalCols
          });
        }
        tableGroups.get(key).cells.push(text);
      } else {
        grouped.push(text);
      }
    });
    
    // テーブルグループを追加
    tableGroups.forEach(group => {
      // セルを行・列順にソート
      group.cells.sort((a: any, b: any) => {
        if (a.tableInfo.row !== b.tableInfo.row) {
          return a.tableInfo.row - b.tableInfo.row;
        }
        return a.tableInfo.col - b.tableInfo.col;
      });
      grouped.push(group);
    });
    
    return grouped;
  };
  
  const displayTexts = groupTableCells(sortedTexts);
  
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
          translations: slide.texts.map(text => ({
            original: text.original,
            translated: text.translated || text.original,
            isTable: text.type === 'TABLE',
            isTableCell: text.type === 'TABLE_CELL',
            tableInfo: text.tableInfo
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
        throw new Error(result.error || t('generateTranslatedFileFailed') || '翻訳済みファイルの生成に失敗しました');
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
      setError(err instanceof Error ? err.message : t('downloadError') || 'ダウンロード中にエラーが発生しました');
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="card dark:bg-slate-800 animate-fadeIn mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors duration-200 text-sm"
              >
                ← {t('backToDashboard')}
              </Link>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {file.original_name}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <LanguageToggle />
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm px-3 py-1.5"
                disabled={isTranslating}
                aria-label={t('targetLanguage') || '翻訳先言語'}
                data-testid="language-select"
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
                <option value="ko">한국어</option>
              </select>
              <button
                onClick={() => handleTranslate(false)}
                disabled={isTranslating || !currentSlide}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 text-sm font-medium"
              >
                {isTranslating ? t('translating') : t('translateCurrentSlide') || '現在のスライドを翻訳'}
              </button>
              <button
                onClick={() => handleTranslate(true)}
                disabled={isTranslating || slides.length === 0}
                className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200 text-sm font-medium"
              >
                {t('translateAll') || 'すべて翻訳'}
              </button>
              
              {/* ダウンロードボタン */}
              <div className="border-l pl-2 ml-2">
                <button
                  onClick={downloadTranslatedPPTX}
                  disabled={isDownloading || slides.length === 0 || !slides.some(s => s.texts.some(t => t.translated))}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-all duration-200 text-sm font-medium flex items-center gap-1.5"
                  title={t('downloadTranslatedPowerPoint') || '翻訳済みのPowerPointファイルをダウンロード'}
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>{t('generating') || '生成中'}...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{t('downloadTranslated') || '翻訳済みをダウンロード'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* エラー表示 */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 animate-fadeIn">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        
        {/* 翻訳進捗バー */}
        {isTranslating && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {translationMessage}
                  </span>
                  {/* パルスアニメーションインジケーター */}
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
                {/* 残り時間表示 */}
                {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    予想残り時間: 約{estimatedTimeRemaining}秒
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* 実際の進捗（デバッグ用、本番では非表示可） */}
                {process.env.NODE_ENV === 'development' && (
                  <span className="text-xs text-gray-400" title="実際の進捗">
                    ({Math.round(realProgress)}%)
                  </span>
                )}
                {/* 表示用の進捗 */}
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(displayProgress)}%
                </span>
              </div>
            </div>
            
            {/* プログレスバー */}
            <div className="relative">
              {/* 背景バー */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                {/* 実際のプログレスバー（デバッグ用、半透明） */}
                {process.env.NODE_ENV === 'development' && (
                  <div 
                    className="absolute top-0 left-0 h-full bg-blue-200 dark:bg-blue-900 rounded-full transition-all duration-500 opacity-50"
                    style={{ width: `${realProgress}%` }}
                  />
                )}
                {/* 表示用のプログレスバー（上に重ねる） */}
                <div 
                  className="relative h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"
                  style={{ 
                    width: `${displayProgress}%`,
                    transition: 'none' // JavaScriptで制御するため
                  }}
                >
                  {/* プログレスバーの先端にグロー効果 */}
                  {displayProgress > 0 && displayProgress < 100 && (
                    <div className="absolute right-0 top-0 h-full w-2 bg-white opacity-50 animate-pulse" />
                  )}
                </div>
              </div>
              
              {/* 完了時のチェックマーク */}
              {displayProgress >= 100 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white animate-scaleIn" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ローディング */}
        {isExtracting && (
          <div className="card dark:bg-slate-800 p-8 text-center animate-scaleIn">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-300">{t('extractingText') || 'PowerPointファイルからテキストを抽出中'}...</p>
          </div>
        )}
        
        {/* メインコンテンツ */}
        {!isExtracting && slides.length > 0 && (
          <>
            {/* MVP説明メッセージ */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 animate-fadeIn">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    <strong>{t('notice') || 'お知らせ'}：</strong> {t('previewNotice') || '現在、スライドのプレビュー画像は準備中です。今後のアップデートで実際のスライド画像が表示されるようになります。現在はテキスト内容の確認と翻訳機能をご利用いただけます。'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* スライドナビゲーション */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {t('slide')} {currentSlide?.pageNumber} / {slides.length}
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
                    aria-label={t('previousSlide')}
                    data-testid="prev-slide"
                  >
                    {t('previous') || '前へ'}
                  </button>
                  <button
                    onClick={() => {
                      setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1));
                      setSelectedTextId(null); // スライド変更時に選択をリセット
                      handleZoomReset(); // ズームと位置をリセット
                    }}
                    disabled={currentSlideIndex === slides.length - 1}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                    aria-label={t('nextSlide')}
                    data-testid="next-slide"
                  >
                    {t('next') || '次へ'}
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
                    data-testid="slide-thumbnail"
                    aria-label={`${t('slide')} ${slide.pageNumber}`}
                  >
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      {t('slide')} {slide.pageNumber}
                    </div>
                    <div className="text-xs text-gray-500">
                      {slide.texts.length} {t('texts') || 'テキスト'}
                    </div>
                    {slide.texts.some(t => t.translated) && (
                      <div className="text-xs text-green-600 mt-1">✓ {t('translated') || '翻訳済み'}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* スライドプレビュー（プレースホルダー） */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{t('slidePreview') || 'スライドプレビュー'}</h3>
                
                {/* ズームコントロール */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title={t('zoomOut') || 'ズームアウト'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium min-w-[80px] text-center text-gray-900 dark:text-gray-100">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title={t('zoomIn') || 'ズームイン'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={handleZoomReset}
                    className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title={t('reset') || 'リセット'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  
                  <div className="ml-2 text-xs text-gray-500">
                    {t('zoomHint') || 'Ctrl + スクロール or ドラッグで移動'}
                  </div>
                </div>
              </div>
              
              <div 
                className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden select-none" 
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
                        alt={`${t('slide')} ${currentSlide.pageNumber}`}
                        className="max-w-full max-h-full"
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-none">
                        <div className="bg-white rounded-lg p-4 max-w-sm text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-gray-600">
                            {t('slidePreviewPreparing') || 'スライドプレビューは準備中です'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {t('comingSoon') || '次回アップデートで追加予定'}
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm" data-testid="preview-container">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">
                  {t('textContent') || 'テキスト内容'} ({currentSlide?.texts.length || 0} {t('items') || '項目'})
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
                            {t('original') || '原文'} 
                            {text.type === 'TABLE_CELL' && text.tableInfo && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {t('table') || '表'}[{text.tableInfo.row + 1},{text.tableInfo.col + 1}]
                              </span>
                            )}
                            {selectedTextId === text.id && (
                              <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                                {t('highlighting') || 'ハイライト中'}
                              </span>
                            )}
                          </div>
                          <div className="text-gray-900 whitespace-pre-wrap" data-testid="slide-text">
                            {text.original}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1 flex items-center justify-between">
                            <span>{t('translation') || '翻訳'}</span>
                            {editingTextId !== text.id && text.translated && (
                              <button
                                onClick={() => startEditingTranslation(text.id, text.translated || '')}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                              >
                                {t('edit') || '編集'}
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
                                  {t('save') || '保存'}
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500 transition-colors"
                                >
                                  {t('cancel') || 'キャンセル'}
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
                              title={text.translated ? t('doubleClickToEdit') || 'ダブルクリックで編集' : ''}
                              style={{ cursor: text.translated ? 'text' : 'default' }}
                            >
                              {text.translated || t('notTranslated') || '未翻訳'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    {t('noTextInSlide') || 'このスライドにはテキストが含まれていません'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
        
        {/* データがない場合 */}
        {!isExtracting && slides.length === 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">{t('noTextData') || 'テキストデータがありません'}</p>
            <button
              onClick={extractText}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('extractText') || 'テキストを抽出'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
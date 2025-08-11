'use client';

import { useState, useEffect } from 'react';
import { batchTranslate } from '@/server-actions/translate/process';
import { uploadPptxAction } from '@/server-actions/files/upload';
import { 
  DynamicEditorScreen, 
  DynamicPreviewScreen, 
  DynamicSettingsScreen 
} from '@/components/DynamicImports';
import { Sidebar } from '@/components/Sidebar';
import { UserNav } from '@/components/UserNav';
import { MobileNav } from '@/components/MobileNav';
import { useResponsive } from '@/hooks/useResponsive';
import { getSettings } from '@/lib/settings';
import { addToHistory, updateHistoryItem, type TranslationHistoryItem } from '@/lib/history';
import type { ProcessingResult } from '@/types';
import type { Settings } from '@/lib/settings';
import { ThemeDebug } from '@/components/ThemeDebug';

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showPreviews, setShowPreviews] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Japanese');
  const [showEditor, setShowEditor] = useState(false);
  const [showPreviewScreen, setShowPreviewScreen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'upload' | 'preview' | 'editor' | 'settings'>('upload');
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const responsive = useResponsive();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        setError('PowerPoint (.pptx) ファイルを選択してください。');
        setFile(null);
      } else {
        setFile(selectedFile);
        setError(null);
      }
    }
  };

  const handleTranslate = async () => {
    if (!processingResult) return;

    setIsTranslating(true);
    setError(null);

    try {
      // すべてのスライドからテキストを収集
      const allTexts: { id: string; originalText: string }[] = [];
      processingResult.slides.forEach(slide => {
        slide.texts.forEach(text => {
          allTexts.push({
            id: text.id,
            originalText: text.original
          });
        });
      });

      if (allTexts.length === 0) {
        setError('翻訳するテキストがありません。');
        return;
      }

      // Server Actionを使用して翻訳
      const result = await batchTranslate({
        texts: allTexts.map(t => ({ id: t.id, text: t.originalText })),
        targetLanguage: targetLanguage as any,
        model: settings.translationModel as any
      });

      if (!result.success) {
        throw new Error(result.error || '翻訳に失敗しました。');
      }

      const translations = result.data?.translations || [];

      // 翻訳結果をprocessingResultに反映
      const updatedResult = { ...processingResult };
      updatedResult.slides = updatedResult.slides.map(slide => ({
        ...slide,
        texts: slide.texts.map(text => {
          const translation = translations.find((t: { id: string; translatedText: string }) => t.id === text.id);
          return {
            ...text,
            translated: translation ? translation.translatedText : text.translated
          };
        })
      }));

      setProcessingResult(updatedResult);
      console.log('Translation successful:', translations);

      // 履歴を更新（翻訳完了）
      if (currentHistoryId) {
        updateHistoryItem(currentHistoryId, {
          status: 'translated',
          textCount: allTexts.length,
        });
      }

    } catch (err) {
      console.error('Translation error:', err);
      const errorMessage = err instanceof Error ? err.message : '翻訳中にエラーが発生しました。';
      setError(errorMessage);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    setProcessingResult(null);
    setShowPreviews(false);

    try {
      // Server Actionを使用してファイルをアップロード
      const formData = new FormData();
      formData.append('file', file);

      const uploadResult = await uploadPptxAction(null, formData);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'ファイルの処理に失敗しました。');
      }

      // TODO: ファイル処理の結果を取得するロジックを実装
      const result: ProcessingResult = uploadResult.data as any;
      
      // Set the processing result and show preview screen
      setProcessingResult(result);
      setShowPreviews(true);
      setShowPreviewScreen(true);  // 自動的にプレビュー画面へ遷移
      setCurrentPage('preview');  // サイドバーも更新
      
      console.log('Processing successful:', result);
      
      // 履歴に追加
      const historyItem = addToHistory({
        fileName: file.name,
        originalFileUrl: result.slides[0]?.originalFileUrl,
        targetLanguage: targetLanguage,
        slideCount: result.totalSlides,
        textCount: result.slides.reduce((total, slide) => total + slide.texts.length, 0),
        translationModel: settings.translationModel,
        status: 'uploaded',
      });
      setCurrentHistoryId(historyItem.id);

    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'ファイル処理中にエラーが発生しました。';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // ページナビゲーション処理
  const handlePageChange = (page: 'upload' | 'preview' | 'editor' | 'settings') => {
    setCurrentPage(page);
    if (page === 'preview') {
      setShowPreviewScreen(true);
      setShowEditor(false);
    } else if (page === 'editor') {
      setShowEditor(true);
      setShowPreviewScreen(false);
    } else if (page === 'upload') {
      setShowPreviewScreen(false);
      setShowEditor(false);
    }
  };

  // 設定変更処理
  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {/* モバイルナビゲーション */}
      {responsive.isMobile && <MobileNav />}
      
      {/* デスクトップサイドバー */}
      {!responsive.isMobile && (
        <Sidebar 
          currentPage={currentPage}
          onPageChange={handlePageChange}
          hasData={processingResult !== null}
        />
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-auto">
        {/* 設定画面 */}
        {currentPage === 'settings' && (
          <DynamicSettingsScreen onSettingsChange={handleSettingsChange} />
        )}

        {/* プレビュー画面 */}
        {currentPage === 'preview' && processingResult && (
          <DynamicPreviewScreen 
            data={processingResult} 
            onBack={() => handlePageChange('upload')}
            onDataUpdate={(updatedData) => {
              setProcessingResult(updatedData);
            }}
            historyId={currentHistoryId}
          />
        )}

        {/* 編集画面 */}
        {currentPage === 'editor' && processingResult && (
          <DynamicEditorScreen 
            data={processingResult} 
            onBack={() => handlePageChange('preview')}
            historyId={currentHistoryId}
          />
        )}

        {/* アップロード画面 */}
        {currentPage === 'upload' && (
          <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header with User Navigation */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div></div>
            {!responsive.isMobile && <UserNav />}
          </div>
          <div className="text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">PowerPoint 翻訳ツール</h1>
            <p className="text-sm md:text-lg text-slate-600 dark:text-slate-400">LibreOffice + pdf2image による高品質変換</p>
          </div>
        </div>

        {/* Upload Section */}
        {!showPreviews && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
              <div className="text-center">
                <p className="text-slate-600">.pptxファイルをアップロードして変換を開始します。</p>
              </div>
              <div className="flex flex-col items-center space-y-4">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="block w-full text-sm text-slate-600
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 file:transition-all file:duration-200"
                />
                {file && <p className="text-sm text-slate-600">選択中のファイル: {file.name}</p>}
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg
                  hover:bg-blue-700 focus:outline-none focus:ring-2
                  focus:ring-offset-2 focus:ring-blue-500
                  disabled:bg-slate-400 disabled:cursor-not-allowed
                  transition-all duration-200 font-medium"
              >
                {isUploading ? '処理中...' : '変換を開始'}
              </button>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isUploading && (
          <div className="max-w-lg mx-auto mt-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="ml-3 text-blue-700 font-medium">
                  PowerPointファイルを変換中です...
                  <br />
                  <span className="text-sm text-blue-600">
                    LibreOffice → PDF → 画像変換 → テキスト抽出
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Preview Results */}
        {showPreviews && processingResult && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    🎉 変換完了 - {processingResult.totalSlides} スライド
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    総テキスト要素: {processingResult.slides.reduce((total, slide) => total + slide.texts.length, 0)} 個
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowPreviewScreen(true)}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-all duration-200 font-medium"
                  >
                    🖼️ プレビュー画面へ
                  </button>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
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
                    onClick={handleTranslate}
                    disabled={isTranslating || processingResult.slides.reduce((total, slide) => total + slide.texts.length, 0) === 0}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1 transition-all duration-200 font-medium"
                  >
                    {isTranslating ? (
                      <>
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                        翻訳中...
                      </>
                    ) : (
                      <>🌐 翻訳</>
                    )}
                  </button>
                  <button
                    onClick={() => setShowEditor(true)}
                    disabled={processingResult.slides.reduce((total, slide) => total + slide.texts.length, 0) === 0}
                    className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1 transition-all duration-200 font-medium"
                  >
                    ✏️ 編集
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 flex items-center gap-1 transition-all duration-200 font-medium border border-blue-200"
                  >
                    📄 印刷
                  </button>
                  <button
                    onClick={() => {
                      setShowPreviews(false);
                      setProcessingResult(null);
                      setFile(null);
                      setError(null);
                    }}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
                  >
                    新しいファイルを選択
                  </button>
                </div>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600">✅</span>
                  <p className="text-emerald-800 font-medium">変換が正常に完了しました</p>
                </div>
                <p className="text-emerald-700 text-sm mt-1">
                  各スライドが高品質な画像に変換され、テキストが正確に抽出されました。
                </p>
              </div>

              {/* Slide Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
                {processingResult.slides.map((slide) => (
                  <div 
                    key={slide.pageNumber} 
                    className="bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all duration-200 group hover:border-blue-300"
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-900 text-sm">
                          📄 スライド {slide.pageNumber}
                        </h3>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium border border-blue-200">
                          {slide.texts.length} テキスト
                        </span>
                      </div>
                      <div className="aspect-video bg-white rounded-lg border border-slate-200 overflow-hidden group-hover:shadow-sm transition-all duration-200">
                        <img
                          src={slide.imageUrl}
                          alt={`Slide ${slide.pageNumber}`}
                          className="w-full h-full object-contain hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjEwMCIgeT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+画像読み込みエラー</dGV4dD48L3N2Zz4=';
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Text Information */}
                    <div className="space-y-2">
                      {slide.texts.length > 0 ? (
                        <details className="group/details">
                          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 flex items-center justify-between transition-all duration-200">
                            <span>💬 抽出テキストを表示</span>
                            <span className="text-xs text-slate-500 group-open/details:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {slide.texts.map((text, index) => (
                              <div key={text.id} className="text-xs bg-white p-2 rounded-lg border-l-2 border-blue-300">
                                <p className="text-slate-800 font-medium line-clamp-2" title={text.original}>
                                  {index + 1}. {text.original}
                                </p>
                                {text.translated && (
                                  <p className="text-emerald-700 text-xs mt-1 line-clamp-2" title={text.translated}>
                                    → {text.translated}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="text-xs text-slate-500 italic flex items-center gap-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <span>🔍</span>
                          <span>テキストが検出されませんでした</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
        )}
      </div>
      <ThemeDebug />
    </div>
  );
}
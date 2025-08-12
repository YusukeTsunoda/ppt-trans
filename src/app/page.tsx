'use client';

import { useState, useEffect, useActionState } from 'react';
import { uploadPptxAction } from '@/lib/server-actions/files/upload';
import { batchTranslate } from '@/lib/server-actions/translate/batch';
import type { UploadResult } from '@/lib/server-actions/files/upload';
import type { TranslationResult } from '@/lib/server-actions/translate/batch';
import { createInitialState, type ServerActionState } from '@/lib/server-actions/types';
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
import { addToHistory, updateHistoryItem } from '@/lib/history';
import type { ProcessingResult } from '@/types';
import type { Settings } from '@/lib/settings';
import { ProgressIndicator, type ProgressStep } from '@/components/ProgressIndicator';

// 初期状態の定義（型安全）
const initialUploadState: ServerActionState<UploadResult> = createInitialState<UploadResult>();
const initialTranslationState: ServerActionState<TranslationResult> = createInitialState<TranslationResult>();

export default function HomePage() {
  // アップロード用のuseActionState（isPending付き）
  const [uploadState, uploadFormAction, isUploadPending] = useActionState(
    uploadPptxAction,
    initialUploadState
  );
  
  // 翻訳用のuseActionState（isPending付き）
  const [translationState, translateFormAction, isTranslationPending] = useActionState(
    batchTranslate,
    initialTranslationState
  );
  
  const [targetLanguage, setTargetLanguage] = useState('Japanese');
  const [currentPage, setCurrentPage] = useState<'upload' | 'preview' | 'editor' | 'settings'>('upload');
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const responsive = useResponsive();
  
  // 派生状態（useEffectではなく直接計算）
  const processingResult = uploadState?.data?.slides ? {
    fileName: uploadState.data.fileName || '',
    slides: translationState?.success && translationState?.data ? 
      // 翻訳結果がある場合はマージ
      uploadState.data.slides.map((slide, slideIndex) => ({
        ...slide,
        texts: slide.texts.map((text, textIndex) => {
          const globalIndex = uploadState.data!.slides
            .slice(0, slideIndex)
            .reduce((sum, s) => sum + s.texts.length, 0) + textIndex;
          return {
            ...text,
            translated: translationState.data!.translatedTexts?.[globalIndex] || null
          };
        })
      })) : 
      // 翻訳結果がない場合はそのまま
      uploadState.data.slides || [],
    totalSlides: uploadState.data.totalSlides || 0
  } as ProcessingResult : null;
  
  const showPreviews = !!processingResult;
  const error = uploadState?.message && !uploadState?.success ? uploadState.message : 
                 translationState?.message && !translationState?.success ? translationState.message : null;
  
  // 翻訳の進捗状態を計算（派生状態）
  const translationProgress = translationState?.data ? {
    current: translationState.data.count || 0,
    total: translationState.data.count || 0,
    status: translationState.success ? 'completed' as const : 
            translationState.message && !translationState.success ? 'error' as const : 'idle' as const,
    message: translationState.message || '',
    steps: [
      { name: 'テキストの前処理', status: 'completed' as const },
      { name: `${targetLanguage}への翻訳処理`, status: translationState.success ? 'completed' as const : 'pending' as const },
      { name: '翻訳結果の反映', status: translationState.success ? 'completed' as const : 'pending' as const }
    ] as ProgressStep[]
  } : {
    current: 0,
    total: 0,
    status: 'idle' as const,
    message: '',
    steps: [] as ProgressStep[]
  };
  
  // 履歴の追加（状態が変化したときに実行）
  useEffect(() => {
    if (uploadState?.success && uploadState?.data && !currentHistoryId) {
      const historyItem = addToHistory({
        fileName: uploadState.data.fileName || '',
        originalFileUrl: uploadState.data.slides?.[0]?.originalFileUrl,
        targetLanguage: targetLanguage,
        slideCount: uploadState.data.totalSlides || 0,
        textCount: uploadState.data.slides?.reduce((total: number, slide: any) => total + (slide.texts?.length || 0), 0) || 0,
        translationModel: settings.translationModel,
        status: 'uploaded',
      });
      setCurrentHistoryId(historyItem.id);
      setCurrentPage('preview');
    }
  }, [uploadState, currentHistoryId, targetLanguage, settings.translationModel]);
  
  // 翻訳完了時の履歴更新
  useEffect(() => {
    if (translationState?.success && currentHistoryId) {
      updateHistoryItem(currentHistoryId, { status: 'translated' });
    }
  }, [translationState, currentHistoryId]);

  // ページナビゲーション処理
  const handlePageChange = (page: 'upload' | 'preview' | 'editor' | 'settings') => {
    setCurrentPage(page);
  };

  // 設定変更処理
  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  // サーバーサイドレンダリング中はすぐにマウントする
  // Next.js 15では不要なため削除

  return (
    <div className="flex h-screen bg-secondary-50">
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
              // データ更新はServer Action経由で行うため、ここでは何もしない
              // 将来的にはServer Actionを呼び出す処理を追加
              console.log('Data update requested:', updatedData);
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
          <div className="w-full">
            <div className="container mx-auto px-4 py-8">
              {/* Header with User Navigation */}
              <div className="mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div></div>
                  {!responsive.isMobile && <UserNav />}
                </div>
                <div className="text-center">
                  <h1 className="text-2xl md:text-4xl font-semibold text-secondary-900 mb-2">PowerPoint 翻訳ツール</h1>
                  <p className="text-sm md:text-lg text-secondary-600">プロフェッショナル向け高品質翻訳サービス</p>
                </div>
              </div>

              {/* Upload Section */}
              {!showPreviews && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-secondary-200 p-8 space-y-6">
              <div className="text-center">
                <p className="text-secondary-600">.pptxファイルをアップロードして翻訳を開始します。</p>
              </div>
              <form action={uploadFormAction} className="space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <input
                    type="file"
                    name="file"
                    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    required
                    className="block w-full text-sm text-secondary-600
                      file:mr-4 file:py-2.5 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-medium
                      file:bg-primary-50 file:text-primary-700
                      hover:file:bg-primary-100 file:transition-colors file:cursor-pointer"
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <button 
                  type="submit"
                  disabled={isUploadPending}
                  className="w-full px-4 py-2.5 text-white bg-primary rounded-lg
                    hover:bg-primary-700 focus:outline-none focus:ring-2
                    focus:ring-offset-2 focus:ring-primary
                    disabled:bg-secondary-400 disabled:cursor-not-allowed
                    transition-colors font-medium shadow-sm"
                >
                  {isUploadPending ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      処理中...
                    </>
                  ) : (
                    'アップロード'
                  )}
                </button>
              </form>
            </div>
          </div>
              )}

              {/* Processing Status - isPendingを使用 */}
              {isUploadPending && (
          <div className="max-w-lg mx-auto mt-8">
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
                <p className="text-primary-700 font-medium">
                  PowerPointファイルを処理中です...
                  <br />
                  <span className="text-sm text-primary-600">
                    ファイル解析 → テキスト抽出 → レイアウト保持
                  </span>
                </p>
              </div>
            </div>
          </div>
              )}

              {/* Preview Results */}
              {showPreviews && processingResult && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    🎉 変換完了 - {processingResult.totalSlides} スライド
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    総テキスト要素: {processingResult.slides.reduce((total, slide) => total + slide.texts.length, 0)} 個
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCurrentPage('preview')}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-all duration-200 font-medium"
                  >
                    🖼️ プレビュー画面へ
                  </button>
                  
                  {/* 翻訳フォーム */}
                  <form action={translateFormAction} className="flex gap-2 items-center">
                    <select
                      name="targetLang"
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="px-3 py-2 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                      disabled={isTranslationPending}
                    >
                      <option value="Japanese">日本語</option>
                      <option value="English">英語</option>
                      <option value="Chinese">中国語</option>
                      <option value="Korean">韓国語</option>
                      <option value="Spanish">スペイン語</option>
                      <option value="French">フランス語</option>
                      <option value="German">ドイツ語</option>
                    </select>
                    <input type="hidden" name="sourceLang" value="auto" />
                    <input 
                      type="hidden" 
                      name="texts" 
                      value={JSON.stringify(
                        processingResult?.slides.flatMap(slide => 
                          slide.texts.filter(text => text.original.trim().length > 0)
                            .map(text => text.original)
                        ) || []
                      )} 
                    />
                    <button
                      type="submit"
                      disabled={isTranslationPending || !processingResult || processingResult.slides.reduce((total, slide) => total + slide.texts.length, 0) === 0}
                      className="px-4 py-2 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1 transition-all duration-200 font-medium"
                    >
                      {isTranslationPending ? (
                        <>
                          <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                          翻訳中...
                        </>
                      ) : (
                        <>🌐 翻訳</>
                      )}
                    </button>
                  </form>
                  <button
                    onClick={() => setCurrentPage('editor')}
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
                      // ページをアップロード画面に戻す
                      setCurrentPage('upload');
                      // 履歴IDをリセット
                      setCurrentHistoryId(null);
                      // ブラウザをリロードして状態をリセット
                      window.location.reload();
                    }}
                    className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium"
                  >
                    新しいファイルを選択
                  </button>
                </div>
              </div>
              
              {/* 翻訳進捗表示 - isPendingを使用 */}
              {isTranslationPending && (
                <div className="mb-6">
                  <ProgressIndicator
                    current={0}
                    total={processingResult?.slides.reduce((total, slide) => total + slide.texts.length, 0) || 0}
                    status="processing"
                    message={`${targetLanguage}への翻訳を処理中...`}
                    steps={[
                      { name: 'テキストの前処理', status: 'completed' },
                      { name: `${targetLanguage}への翻訳処理`, status: 'in_progress' },
                      { name: '翻訳結果の反映', status: 'pending' }
                    ]}
                    showDetails={true}
                  />
                </div>
              )}
              
              {/* 翻訳完了メッセージ */}
              {translationProgress.status === 'completed' && (
                <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-accent-600">✅</span>
                    <p className="text-accent-800 font-medium">翻訳が正常に完了しました</p>
                  </div>
                  <p className="text-accent-700 text-sm mt-1">
                    {translationProgress.total}個のテキストを翻訳しました。
                  </p>
                </div>
              )}
              
              {/* エラーメッセージ */}
              {translationProgress.status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-red-600">⚠️</span>
                    <p className="text-red-800 font-medium">翻訳中にエラーが発生しました</p>
                  </div>
                  <p className="text-red-700 text-sm mt-1">
                    {translationProgress.message}
                  </p>
                </div>
              )}
              
              <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-accent-600">✅</span>
                  <p className="text-accent-800 font-medium">変換が正常に完了しました</p>
                </div>
                <p className="text-accent-700 text-sm mt-1">
                  各スライドが高品質な画像に変換され、テキストが正確に抽出されました。
                </p>
              </div>

              {/* Slide Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4">
                {processingResult.slides.map((slide) => (
                  <div 
                    key={slide.pageNumber} 
                    className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all duration-200 group hover:border-blue-300 dark:hover:border-blue-600"
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          📄 スライド {slide.pageNumber}
                        </h3>
                        <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium border border-blue-200 dark:border-blue-700">
                          {slide.texts.length} テキスト
                        </span>
                      </div>
                      <div className="aspect-video bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden group-hover:shadow-sm transition-all duration-200">
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
                              <div key={text.id} className="text-xs bg-white dark:bg-slate-700 p-2 rounded-lg border-l-2 border-blue-300 dark:border-blue-600">
                                <p className="text-slate-800 dark:text-slate-200 font-medium line-clamp-2" title={text.original}>
                                  {index + 1}. {text.original}
                                </p>
                                {text.translated && (
                                  <p className="text-slate-900 dark:text-slate-100 text-xs mt-1 line-clamp-2" title={text.translated}>
                                    → {text.translated}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
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
          </div>
        )}
      </div>
    </div>
  );
}
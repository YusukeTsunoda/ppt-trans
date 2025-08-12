'use client';

import { useState } from 'react';
import { updateHistoryItem } from '@/lib/history';
import { DownloadButton } from '@/components/DownloadButton';
import { useToast } from '@/components/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { generatePptx } from '@/server-actions/generate/pptx';
import type { EditorScreenProps } from '@/types';

export function EditorScreen({ data, onBack, historyId }: EditorScreenProps) {
  const { showToast } = useToast();
  const responsive = useResponsive();
  const [editedData, setEditedData] = useState(data);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [_isSaving, _setIsSaving] = useState(false);

  // 翻訳テキストを編集
  const handleTextEdit = (slideIndex: number, textId: string, newTranslation: string) => {
    const updatedData = { ...editedData };
    updatedData.slides[slideIndex].texts = updatedData.slides[slideIndex].texts.map(text => {
      if (text.id === textId) {
        return { ...text, translated: newTranslation };
      }
      return text;
    });
    setEditedData(updatedData);
  };

  // 編集内容を保存してダウンロード（Server Action版）
  const _handleDownload = async () => {
    _setIsSaving(true);
    try {
      // 最初のスライドから元のファイルURLを取得
      const originalFileUrl = editedData.slides[0]?.originalFileUrl;
      if (!originalFileUrl) {
        throw new Error('元のファイルURLが見つかりません');
      }

      // Server Actionに送信するデータを準備
      const requestData = {
        originalFileUrl,
        editedSlides: editedData.slides.map(slide => ({
          pageNumber: slide.pageNumber,
          texts: slide.texts.map(text => ({
            id: text.id,
            original: text.original,
            translated: text.translated || text.original // 翻訳がない場合は元のテキストを使用
          }))
        }))
      };

      console.log('Generating translated PPTX with Server Action...', requestData);

      // Server Actionを使用してPPTXファイルを生成
      const result = await generatePptx(requestData);

      if (!result.success) {
        throw new Error(result.error || 'PPTXファイルの生成に失敗しました');
      }

      console.log('PPTX generation result:', result);

      // ダウンロード処理
      if (result.downloadUrl) {
        // ブラウザがCORSを処理できる場合は直接ダウンロード
        try {
          const fileResponse = await fetch(result.downloadUrl);
          if (fileResponse.ok) {
            const blob = await fileResponse.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.fileName || 'translated_presentation.pptx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            // 履歴を更新（ダウンロード完了）
            if (historyId) {
              await updateHistoryItem(historyId, {
                status: 'downloaded',
                translatedFileUrl: result.downloadUrl,
              });
            }
            
            // 成功通知
            showToast('翻訳版のPPTXファイルをダウンロードしました', 'success');
            return;
          }
        } catch (corsError) {
          console.log('Direct download failed, trying fallback method...', corsError);
        }
        
        // CORS エラーの場合はリンククリックでダウンロード
        const downloadLink = document.createElement('a');
        downloadLink.href = result.downloadUrl;
        downloadLink.download = result.fileName || 'translated_presentation.pptx';
        downloadLink.target = '_blank';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // 履歴を更新（ダウンロード完了）
        if (historyId) {
          await updateHistoryItem(historyId, {
            status: 'downloaded',
            translatedFileUrl: result.downloadUrl,
          });
        }
        
        showToast('翻訳版のPPTXファイルをダウンロードしました', 'success');
      } else {
        throw new Error('ダウンロードURLが取得できませんでした');
      }
      
    } catch (error) {
      console.error('Download error:', error);
      showToast(
        `ダウンロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        'error'
      );
    } finally {
      _setIsSaving(false);
    }
  };

  // ダウンロード成功時の処理（新規追加）
  const handleDownloadSuccess = async (downloadUrl: string) => {
    // 履歴を更新（成功）
    if (historyId) {
      await updateHistoryItem(historyId, {
        status: 'downloaded',
        translatedFileUrl: downloadUrl,
        completedAt: new Date().toISOString()
      });
    }
    showToast('翻訳済みファイルのダウンロードが完了しました', 'success');
  };

  // ダウンロードエラー時の処理（新規追加）
  const handleDownloadError = async (error: Error) => {
    // 履歴を更新（失敗）
    if (historyId) {
      await updateHistoryItem(historyId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
      });
    }
    showToast(`ダウンロードに失敗しました: ${error.message}`, 'error');
  };

  const currentSlide = editedData.slides[selectedSlide];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center gap-2 transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                戻る
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">翻訳編集画面</h1>
            </div>
            <div className="flex gap-2">
              <DownloadButton
                editedSlides={editedData.slides}
                onSuccess={handleDownloadSuccess}
                onError={handleDownloadError}
                className="px-6 py-2"
              />
            </div>
          </div>
        </div>

        <div className={`grid ${responsive.isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-6`}>
          {/* 左側：スライドプレビュー */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              {/* スライドナビゲーション */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={() => setSelectedSlide(Math.max(0, selectedSlide - 1))}
                  disabled={selectedSlide === 0}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  ← 前のスライド
                </button>
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  スライド {selectedSlide + 1} / {editedData.totalSlides}
                </span>
                <button
                  onClick={() => setSelectedSlide(Math.min(editedData.totalSlides - 1, selectedSlide + 1))}
                  disabled={selectedSlide === editedData.totalSlides - 1}
                  className="px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  次のスライド →
                </button>
              </div>

              {/* スライド画像 */}
              <div className="relative bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                <img
                  src={currentSlide.imageUrl}
                  alt={`Slide ${currentSlide.pageNumber}`}
                  className="w-full h-auto"
                />
                
                {/* テキストボックスのオーバーレイ（選択中のみ表示） */}
                {currentSlide.texts.map((text) => {
                  // 編集中のテキストのみハイライト表示
                  if (isEditing !== text.id) return null;
                  
                  // PowerPointの標準スライドサイズ（16:9）
                  // PowerPointの標準: 10インチ x 5.625インチ = 720pt x 405pt
                  // Pythonスクリプトはポイント単位で位置を返している
                  const slideWidth = 720;  // PowerPoint標準幅（ポイント）
                  const slideHeight = 405; // PowerPoint標準高さ（ポイント）
                  
                  return (
                    <div
                      key={text.id}
                      className="absolute border-2 border-blue-500 cursor-pointer transition-all duration-200 rounded"
                      style={{
                        left: `${(text.position.x / slideWidth) * 100}%`,
                        top: `${(text.position.y / slideHeight) * 100}%`,
                        width: `${(text.position.width / slideWidth) * 100}%`,
                        height: `${(text.position.height / slideHeight) * 100}%`,
                        // 背景を完全に透明にして、枠線のみ表示
                        backgroundColor: 'transparent',
                      }}
                      onClick={() => setIsEditing(text.id)}
                      title={text.original}
                    />
                  );
                })}
              </div>

              {/* スライドサムネイル一覧 */}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {editedData.slides.map((slide, index) => (
                  <button
                    key={slide.pageNumber}
                    onClick={() => setSelectedSlide(index)}
                    className={`flex-shrink-0 w-24 h-16 rounded-lg border-2 overflow-hidden transition-all duration-200 ${
                      index === selectedSlide
                        ? 'border-blue-600 ring-2 ring-blue-400 shadow-md'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <img
                      src={slide.imageUrl}
                      alt={`Slide ${slide.pageNumber} thumbnail`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右側：テキスト編集パネル */}
          <div className="lg:col-span-1">
            <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 ${responsive.isMobile ? '' : 'sticky top-6'}`}>
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                テキスト編集
              </h2>
              
              {currentSlide.texts.length > 0 ? (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {currentSlide.texts.map((text, index) => (
                    <div
                      key={text.id}
                      className={`p-4 border rounded-lg transition-all duration-200 cursor-pointer ${
                        isEditing === text.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                      }`}
                      onClick={() => setIsEditing(text.id)}
                    >
                      <div className="mb-2">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          元のテキスト #{index + 1}
                        </label>
                        <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-600">
                          {text.original}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          翻訳テキスト
                        </label>
                        {isEditing === text.id ? (
                          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              value={text.translated}
                              onChange={(e) => handleTextEdit(selectedSlide, text.id, e.target.value)}
                              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700 transition-all duration-200"
                              rows={3}
                              autoFocus
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsEditing(null);
                                }}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium"
                              >
                                完了
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTextEdit(selectedSlide, text.id, text.original);
                                  setIsEditing(null);
                                }}
                                className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 font-medium"
                              >
                                リセット
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="mt-1 p-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditing(text.id);
                            }}
                          >
                            <span className={text.translated ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500 italic"}>
                              {text.translated || '(未翻訳)'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  このスライドにはテキストがありません
                </div>
              )}

              {/* 一括操作ボタン */}
              {currentSlide.texts.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      // すべての翻訳を元のテキストにリセット
                      const updatedData = { ...editedData };
                      updatedData.slides[selectedSlide].texts = currentSlide.texts.map(text => ({
                        ...text,
                        translated: text.original
                      }));
                      setEditedData(updatedData);
                    }}
                    className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 font-medium flex items-center justify-center gap-2"
                  >
                    🔄 このスライドの翻訳をリセット
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';

interface Slide {
  id: string;
  slideNumber: number;
  originalText: string[];
  translatedText: string[];
  thumbnail?: string;
}

interface TranslationEditorProps {
  fileId: string;
  slides: Slide[];
  onSave: (updates: Record<string, string[]>) => Promise<void>;
}

export default function TranslationEditor({ fileId, slides, onSave }: TranslationEditorProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editedTranslations, setEditedTranslations] = useState<Record<string, string[]>>({});
  const [highlightedText, setHighlightedText] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [splitView, setSplitView] = useState<'horizontal' | 'vertical'>('horizontal');

  // Design.md準拠のハイライト連動
  const handleTextHover = (index: number | null) => {
    setHighlightedText(index);
  };

  const handleTranslationEdit = (slideId: string, textIndex: number, newText: string) => {
    setEditedTranslations(prev => ({
      ...prev,
      [slideId]: {
        ...(prev[slideId] || slides.find(s => s.id === slideId)?.translatedText || []),
        [textIndex]: newText
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedTranslations);
      // 成功時のフィードバック - Design.md準拠
      const successToast = document.createElement('div');
      successToast.className = 'fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fadeIn z-50';
      successToast.innerHTML = '✓ 保存しました';
      document.body.appendChild(successToast);
      setTimeout(() => successToast.remove(), 3000);
    } catch (error) {
      // エラー時のフィードバック
      const errorToast = document.createElement('div');
      errorToast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fadeIn z-50';
      errorToast.innerHTML = '✕ 保存に失敗しました';
      document.body.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const currentSlideData = slides[currentSlide];
  if (!currentSlideData) return null;

  return (
    <div className="h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200">
      {/* ツールバー - Design.md準拠のスタイル */}
      <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-all duration-200"
          >
            <span className="text-xl">←</span>
          </button>
          <span className="text-sm font-medium text-slate-900">
            スライド {currentSlide + 1} / {slides.length}
          </span>
          <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-all duration-200"
          >
            <span className="text-xl">→</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* 言語切り替えボタン - Design.md準拠 */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">A</span>
            <span className="text-blue-600">→</span>
            <span className="text-sm text-slate-600">あ</span>
          </div>
          
          <button
            onClick={() => setSplitView(splitView === 'horizontal' ? 'vertical' : 'horizontal')}
            className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg hover:bg-slate-200 transition-all duration-200"
          >
            {splitView === 'horizontal' ? '⬍' : '⬌'}
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || Object.keys(editedTranslations).length === 0}
            className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-500 text-white 
                     rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all duration-200"
          >
            <span>💾</span>
            <span>{isSaving ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </div>

      {/* ツインパネル - Design.md準拠のレイアウト */}
      <div className={`flex ${splitView === 'horizontal' ? 'flex-row' : 'flex-col'} h-[calc(100%-8rem)]`}>
        {/* 左パネル: 原文 */}
        <div className="flex-1 border-r border-slate-200 p-6 overflow-auto bg-slate-50">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center">
            <span className="text-blue-600 mr-2">📝</span>
            原文
          </h3>
          <div className="space-y-3">
            {currentSlideData?.originalText.map((text, index) => (
              <div
                key={index}
                onMouseEnter={() => handleTextHover(index)}
                onMouseLeave={() => handleTextHover(null)}
                className={`
                  p-4 rounded-lg border transition-all duration-200 cursor-pointer bg-white
                  ${highlightedText === index 
                    ? 'border-blue-600 shadow-sm transform scale-[1.02]' 
                    : 'border-slate-200 hover:border-slate-300'
                  }
                `}
              >
                <span className="text-xs text-slate-500 block mb-1">
                  テキスト {index + 1}
                </span>
                <p className="text-slate-900">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 中央の矢印アイコン - Design.md準拠 */}
        <div className="flex items-center justify-center px-2 bg-gradient-to-b from-blue-50 to-emerald-50">
          <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center">
            <span className="text-blue-600 text-xl">→</span>
          </div>
        </div>

        {/* 右パネル: 翻訳 */}
        <div className="flex-1 p-6 overflow-auto bg-white">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center">
            <span className="text-emerald-500 mr-2">🌐</span>
            翻訳
          </h3>
          <div className="space-y-3">
            {currentSlideData?.translatedText.map((text, index) => (
              <div
                key={index}
                onMouseEnter={() => handleTextHover(index)}
                onMouseLeave={() => handleTextHover(null)}
                className={`
                  p-4 rounded-lg border transition-all duration-200
                  ${highlightedText === index 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm transform scale-[1.02]' 
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }
                `}
              >
                <span className="text-xs text-slate-500 block mb-1">
                  テキスト {index + 1}
                </span>
                <textarea
                  value={
                    editedTranslations[currentSlideData.id]?.[index] ?? text
                  }
                  onChange={(e) => handleTranslationEdit(
                    currentSlideData.id, 
                    index, 
                    e.target.value
                  )}
                  className="w-full p-2 border-0 bg-transparent resize-none focus:outline-none text-slate-900"
                  rows={Math.max(2, text.split('\n').length)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* スライドサムネイル - Design.md準拠のスタイル */}
      <div className="border-t border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`
                flex-shrink-0 w-20 h-16 rounded-lg border-2 overflow-hidden
                transition-all duration-200 transform hover:scale-105
                ${currentSlide === index 
                  ? 'border-blue-600 shadow-lg ring-2 ring-blue-600 ring-offset-2' 
                  : 'border-slate-200 hover:border-slate-300'
                }
              `}
            >
              {slide.thumbnail ? (
                <img src={slide.thumbnail} alt={`Slide ${index + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                  {index + 1}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
'use client';

import React from 'react';

interface TranslationControlsProps {
  targetLanguage: string;
  isTranslating: boolean;
  hasExtractedData: boolean;
  translationProgress: number;
  translationMessage: string;
  onLanguageChange: (language: string) => void;
  onTranslate: () => void;
  onDownload: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'ja', name: '日本語' },
  { code: 'en', name: '英語' },
  { code: 'zh', name: '中国語' },
  { code: 'ko', name: '韓国語' },
  { code: 'es', name: 'スペイン語' },
  { code: 'fr', name: 'フランス語' },
  { code: 'de', name: 'ドイツ語' },
  { code: 'it', name: 'イタリア語' },
  { code: 'pt', name: 'ポルトガル語' },
  { code: 'ru', name: 'ロシア語' }
];

export function TranslationControls({
  targetLanguage,
  isTranslating,
  hasExtractedData,
  translationProgress,
  translationMessage,
  onLanguageChange,
  onTranslate,
  onDownload
}: TranslationControlsProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center gap-3">
        <label htmlFor="language" className="text-sm font-medium text-gray-700">
          翻訳先言語:
        </label>
        <select
          id="language"
          value={targetLanguage}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={isTranslating}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
      
      <button
        onClick={onTranslate}
        disabled={!hasExtractedData || isTranslating}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
      >
        {isTranslating ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            翻訳中... ({Math.round(translationProgress)}%)
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            翻訳する
          </>
        )}
      </button>
      
      <button
        onClick={onDownload}
        disabled={!hasExtractedData || isTranslating}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
        ダウンロード
      </button>
      
      {translationMessage && (
        <div className={`text-sm ${isTranslating ? 'text-blue-600' : 'text-green-600'}`}>
          {translationMessage}
        </div>
      )}
    </div>
  );
}
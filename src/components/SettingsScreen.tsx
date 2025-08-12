'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { getTranslationHistory, deleteHistoryItem, clearHistory, type TranslationHistoryItem } from '@/lib/history';
import type { Settings, TranslationModel } from '@/lib/settings';

interface SettingsScreenProps {
  onSettingsChange?: (settings: Settings) => void;
}

export function SettingsScreen({ onSettingsChange }: SettingsScreenProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    translationModel: 'claude-3-haiku-20240307',
    autoSave: true,
    theme: 'light',
    language: 'ja',
    batchSize: 5
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set());

  // マウント状態を管理（ハイドレーションエラー防止）
  useEffect(() => {
    setMounted(true);
  }, []);

  // ローカルストレージから設定と履歴を読み込む
  useEffect(() => {
    const savedSettings = localStorage.getItem('pptx-translator-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
    
    // 履歴を読み込む
    const loadedHistory = getTranslationHistory();
    setHistory(loadedHistory);
  }, []);

  // テーマを同期（mountedになった後）
  useEffect(() => {
    if (mounted && settings.theme) {
      console.log('Setting theme to:', settings.theme);
      setTheme(settings.theme);
    }
  }, [mounted, settings.theme, setTheme]);

  // デバッグ: 現在のテーマ状態を確認
  useEffect(() => {
    console.log('Current theme from useTheme:', theme);
    console.log('Current settings.theme:', settings.theme);
    console.log('Is mounted:', mounted);
  }, [theme, settings.theme, mounted]);

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      // ローカルストレージに保存
      localStorage.setItem('pptx-translator-settings', JSON.stringify(settings));
      
      // 親コンポーネントに通知
      if (onSettingsChange) {
        onSettingsChange(settings);
      }

      setSaveMessage('設定を保存しました');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
      setSaveMessage('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    const defaultSettings: Settings = {
      translationModel: 'claude-3-haiku-20240307',
      autoSave: true,
      theme: 'light',
      language: 'ja',
      batchSize: 5
    };
    setSettings(defaultSettings);
  };

  // 履歴アイテムを削除
  const handleDeleteHistoryItem = (id: string) => {
    deleteHistoryItem(id);
    setHistory(getTranslationHistory());
  };

  // すべての履歴をクリア
  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
    setShowClearConfirm(false);
  };

  // ファイルをダウンロード
  const handleDownloadFile = async (url: string, fileName: string, itemId: string, fileType: 'original' | 'translated') => {
    const downloadId = `${itemId}-${fileType}`;
    
    try {
      // ダウンロード中の状態を設定
      setDownloadingItems(prev => new Set(prev).add(downloadId));
      console.log('Downloading file from:', url);
      
      // Supabase URLの場合、直接ダウンロードリンクを使用
      if (url.includes('supabase')) {
        // 方法1: fetchでダウンロード（CORSが許可されている場合）
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/vnd.openxmlformats-officedocument.presentationml.presentation, application/octet-stream'
            }
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
            console.log('Download successful via fetch');
            return;
          }
        } catch (fetchError) {
          console.log('Fetch download failed, trying direct link...', fetchError);
        }
        
        // 方法2: 直接リンクでダウンロード（CORSエラーの場合）
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log('Download initiated via direct link');
      } else {
        // その他のURLの場合
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pptx') ? fileName : `${fileName}.pptx`;
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('Download error:', e);
      alert('ファイルのダウンロードに失敗しました。URLが無効か、ファイルが存在しない可能性があります。');
    } finally {
      // ダウンロード中の状態を解除
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadId);
        return newSet;
      });
    }
  };

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* ヘッダー */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">設定</h1>
          <p className="text-slate-600 dark:text-slate-400">アプリケーションの動作をカスタマイズします</p>
        </div>

        {/* 翻訳設定 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            翻訳設定
          </h2>

          <div className="space-y-4">
            {/* 翻訳モデル選択 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                翻訳AIモデル
              </label>
              <select
                value={settings.translationModel}
                onChange={(e) => setSettings({ ...settings, translationModel: e.target.value as TranslationModel })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-700"
              >
                <option value="claude-3-haiku-20240307">
                  Claude 3 Haiku (高速・低コスト)
                </option>
                <option value="claude-3-5-sonnet-20241022">
                  Claude 3.5 Sonnet (高精度・推奨)
                </option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {settings.translationModel === 'claude-3-haiku-20240307' && '最も高速で低コスト。基本的な翻訳に適しています。'}
                {settings.translationModel === 'claude-3-5-sonnet-20241022' && '最高精度で最新モデル。専門的な内容や重要な文書に推奨。'}
              </p>
            </div>

            {/* バッチサイズ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                一度に翻訳するテキスト数
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.batchSize}
                onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) || 5 })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
              />
              <p className="mt-1 text-xs text-slate-500">
                大きい値にすると翻訳が速くなりますが、エラーが発生しやすくなる可能性があります。
              </p>
            </div>
          </div>
        </div>

        {/* アプリケーション設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            アプリケーション設定
          </h2>

          <div className="space-y-4">
            {/* 自動保存 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  自動保存
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  編集内容を自動的に保存します
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, autoSave: !settings.autoSave })}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${settings.autoSave ? 'bg-blue-600' : 'bg-slate-300'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${settings.autoSave ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* テーマ */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                テーマ
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    console.log('Light button clicked');
                    setSettings({ ...settings, theme: 'light' });
                    setTheme('light');
                    console.log('Called setTheme with light');
                  }}
                  disabled={!mounted}
                  className={`
                    flex-1 px-4 py-2 rounded-lg border transition-all
                    ${theme === 'light' 
                      ? 'bg-blue-50 border-blue-300 text-blue-700' 
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  ライト
                </button>
                <button
                  onClick={() => {
                    console.log('Dark button clicked');
                    setSettings({ ...settings, theme: 'dark' });
                    setTheme('dark');
                    console.log('Called setTheme with dark');
                  }}
                  disabled={!mounted}
                  className={`
                    flex-1 px-4 py-2 rounded-lg border transition-all
                    ${theme === 'dark' 
                      ? 'bg-slate-800 border-blue-600 text-blue-400' 
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  ダーク
                </button>
              </div>
            </div>

            {/* 言語 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                表示言語
              </label>
              <select
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value as 'ja' | 'en' })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
              >
                <option value="ja">日本語</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* 翻訳履歴 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              翻訳履歴
            </h2>
            {history.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all"
              >
                すべてクリア
              </button>
            )}
          </div>

          {showClearConfirm && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 mb-2">本当にすべての履歴を削除しますか？</p>
              <div className="flex gap-2">
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-all"
                >
                  削除する
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1 text-sm bg-white text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition-all"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          {history.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <div key={item.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 hover:shadow-sm transition-all duration-200">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 text-sm truncate" title={item.fileName}>
                        📄 {item.fileName}
                      </h3>
                      <p className="text-xs text-slate-600 mt-1.5">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatDate(item.createdAt)}
                        </span>
                        <span className="mx-1.5">•</span>
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          {item.targetLanguage}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {item.slideCount}スライド • {item.textCount}テキスト
                        </span>
                        <span className="mx-1.5">•</span>
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {item.translationModel.includes('haiku') ? 'Haiku' : 'Sonnet'}
                        </span>
                      </p>
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                          item.status === 'downloaded' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'translated' ? 'bg-blue-100 text-blue-700' :
                          item.status === 'translating' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {item.status === 'downloaded' ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              ダウンロード済み
                            </>
                          ) : item.status === 'translated' ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              翻訳完了
                            </>
                          ) : item.status === 'translating' ? (
                            <>
                              <span className="animate-spin inline-block w-3 h-3 border-2 border-yellow-600 border-t-transparent rounded-full"></span>
                              翻訳中
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              アップロード済み
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <button
                        onClick={() => {
                          if (item.originalFileUrl) {
                            handleDownloadFile(item.originalFileUrl, `original_${item.fileName}`, item.id, 'original');
                          }
                        }}
                        disabled={!item.originalFileUrl || downloadingItems.has(`${item.id}-original`)}
                        className="w-full px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 border border-blue-200 hover:border-blue-300 disabled:border-slate-200 shadow-sm hover:shadow-md"
                        title="元のファイルをダウンロード"
                      >
                        {downloadingItems.has(`${item.id}-original`) ? (
                          <>
                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full"></span>
                            ダウンロード中...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            元ファイル
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (item.translatedFileUrl) {
                            handleDownloadFile(item.translatedFileUrl, `translated_${item.fileName}`, item.id, 'translated');
                          }
                        }}
                        disabled={!item.translatedFileUrl || downloadingItems.has(`${item.id}-translated`)}
                        className="w-full px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-1.5 border border-emerald-200 hover:border-emerald-300 disabled:border-slate-200 shadow-sm hover:shadow-md"
                        title="翻訳済みファイルをダウンロード"
                      >
                        {downloadingItems.has(`${item.id}-translated`) ? (
                          <>
                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full"></span>
                            ダウンロード中...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            翻訳ファイル
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteHistoryItem(item.id)}
                        className="w-full px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-1.5 border border-red-200 hover:border-red-300"
                        title="この履歴を削除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-slate-500">翻訳履歴がありません</p>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
          >
            デフォルトに戻す
          </button>
          <div className="flex gap-2 items-center">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMessage}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                  保存中...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                  </svg>
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
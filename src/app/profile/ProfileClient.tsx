'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateProfileSettings } from '@/lib/server-actions/profile/get';

import type { ProfileData } from '@/lib/server-actions/profile/get';

interface ProfileClientProps {
  initialProfile: ProfileData;
}

export default function ProfileClient({ initialProfile }: ProfileClientProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [settings, setSettings] = useState(initialProfile.settings || {
    translationModel: 'claude-3-haiku',
    targetLanguage: 'ja',
    batchSize: 5
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage('');
    
    // Server ActionはFormDataと初期状態を期待
    const formData = new FormData();
    formData.append('settings', JSON.stringify(settings));
    
    const initialState = {
      success: false,
      message: '',
      timestamp: Date.now()
    };
    
    const result = await updateProfileSettings(initialState, formData);
    
    if (result.success) {
      setMessage('設定を保存しました');
      setIsEditing(false);
    } else {
      setMessage(result.message || '設定の保存に失敗しました');
    }
    
    setIsSaving(false);
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">プロフィール</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              アカウント情報と設定
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            ← ホームに戻る
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">アカウント情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ユーザー名
              </label>
              <p className="mt-1 text-foreground">{initialProfile.username}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                メールアドレス
              </label>
              <p className="mt-1 text-foreground">{initialProfile.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ロール
              </label>
              <p className="mt-1">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  initialProfile.role === 'ADMIN' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {initialProfile.role}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                登録日
              </label>
              <p className="mt-1 text-foreground">
                {new Date(initialProfile.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ファイル数
              </label>
              <p className="mt-1 text-foreground">
                {initialProfile.filesCount} 件
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">使用統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {initialProfile.filesCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                アップロードファイル
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {initialProfile.role === 'ADMIN' ? '管理者' : 'ユーザー'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ロール
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {settings.targetLanguage || 'ja'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ターゲット言語
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {settings.batchSize || 5}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                バッチサイズ
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-foreground">翻訳設定</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                編集
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setSettings(initialProfile.settings || {
                      translationModel: 'claude-3-haiku',
                      targetLanguage: 'ja',
                      batchSize: 5
                    });
                  }}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-accent-600 text-white rounded-lg hover:bg-accent-700 disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.includes('失敗') || message.includes('エラー')
                ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                : 'bg-accent-100 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400'
            }`}>
              {message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                翻訳モデル
              </label>
              {isEditing ? (
                <select
                  value={settings.translationModel}
                  onChange={(e) => setSettings({ ...settings, translationModel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
                >
                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (高速)</option>
                  <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (高品質)</option>
                  <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                  <option value="claude-3-opus-20240229">Claude 3 Opus (最高品質)</option>
                </select>
              ) : (
                <p className="text-foreground">
                  {settings.translationModel.replace('claude-3-', 'Claude 3 ').replace('-20240307', '')}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                デフォルト翻訳言語
              </label>
              {isEditing ? (
                <select
                  value={settings.targetLanguage}
                  onChange={(e) => setSettings({ ...settings, targetLanguage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
                >
                  <option value="Japanese">日本語</option>
                  <option value="English">英語</option>
                  <option value="Chinese">中国語</option>
                  <option value="Korean">韓国語</option>
                  <option value="Spanish">スペイン語</option>
                  <option value="French">フランス語</option>
                  <option value="German">ドイツ語</option>
                </select>
              ) : (
                <p className="text-foreground">{settings.targetLanguage}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                バッチサイズ
              </label>
              {isEditing ? (
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={settings.batchSize}
                  onChange={(e) => setSettings({ ...settings, batchSize: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
                />
              ) : (
                <p className="text-foreground">{settings.batchSize}</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
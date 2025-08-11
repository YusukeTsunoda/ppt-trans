'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  settings: {
    translationModel: string;
    targetLanguage: string;
    batchSize: number;
    autoSave: boolean;
    theme: string;
  };
  stats: {
    totalFiles: number;
    totalTranslations: number;
    totalSlides: number;
    storageUsed: number;
  };
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [settings, setSettings] = useState({
    translationModel: 'claude-3-haiku-20240307',
    targetLanguage: 'Japanese',
    batchSize: 5,
    autoSave: true,
    theme: 'light'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login');
      return;
    }

    fetchProfile();
  }, [session, status, router]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/profile/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setMessage('設定を保存しました');
        setIsEditing(false);
        fetchProfile();
      } else {
        setMessage('設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage('設定の保存中にエラーが発生しました');
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">プロフィールの取得に失敗しました</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ヘッダー */}
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

        {/* プロフィール情報 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">アカウント情報</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ユーザー名
              </label>
              <p className="mt-1 text-foreground">{profile.username}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                メールアドレス
              </label>
              <p className="mt-1 text-foreground">{profile.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                ロール
              </label>
              <p className="mt-1">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  profile.role === 'ADMIN' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {profile.role}
                </span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                登録日
              </label>
              <p className="mt-1 text-foreground">
                {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                最終ログイン
              </label>
              <p className="mt-1 text-foreground">
                {profile.lastLoginAt 
                  ? formatDistanceToNow(new Date(profile.lastLoginAt), { 
                      addSuffix: true, 
                      locale: ja 
                    })
                  : '未ログイン'}
              </p>
            </div>
          </div>
        </div>

        {/* 使用統計 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">使用統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {profile.stats.totalFiles}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ファイル
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {profile.stats.totalTranslations}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                翻訳
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {profile.stats.totalSlides}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                スライド
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-foreground">
                {formatBytes(profile.stats.storageUsed)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ストレージ
              </div>
            </div>
          </div>
        </div>

        {/* 設定 */}
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
                    setSettings(profile.settings);
                  }}
                  className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
                : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
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

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                自動保存
              </label>
              {isEditing ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => setSettings({ ...settings, autoSave: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-foreground">
                    {settings.autoSave ? '有効' : '無効'}
                  </span>
                </div>
              ) : (
                <p className="text-foreground">
                  {settings.autoSave ? '有効' : '無効'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                テーマ
              </label>
              {isEditing ? (
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-background"
                >
                  <option value="light">ライト</option>
                  <option value="dark">ダーク</option>
                  <option value="system">システム</option>
                </select>
              ) : (
                <p className="text-foreground">
                  {settings.theme === 'light' ? 'ライト' : settings.theme === 'dark' ? 'ダーク' : 'システム'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { updateProfileAction } from '@/app/actions/profile';
import type { Profile } from '@/lib/data/profile';
import { User, Settings, Bell, Shield, Palette, Globe, ChevronRight, Camera, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { LanguageToggle } from '@/components/LanguageToggle';

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useTranslation();
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? t('savingChanges') : t('saveChanges')}
    </button>
  );
}

interface ProfileClientProps {
  userId: string;
  userEmail: string;
  initialProfile: Profile | null;
}

type TabType = 'profile' | 'settings' | 'notifications' | 'security';

export default function ProfileClient({ userId, userEmail, initialProfile }: ProfileClientProps) {
  const [state, formAction] = useActionState(updateProfileAction, null);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [settings, setSettings] = useState({
    language: 'ja',
    theme: 'light',
    autoTranslate: false,
    emailNotifications: true,
    pushNotifications: false,
    twoFactorEnabled: false,
  });
  const { t } = useTranslation();
  
  const tabs = [
    { id: 'profile' as TabType, label: t('profile'), icon: User },
    { id: 'settings' as TabType, label: t('generalSettings'), icon: Settings },
    { id: 'notifications' as TabType, label: t('notifications'), icon: Bell },
    { id: 'security' as TabType, label: t('security'), icon: Shield },
  ];
  
  return (
    <div className="min-h-screen gradient-bg dark:bg-slate-900 animate-fadeIn">
      {/* ヘッダー */}
      <div className="header-gradient dark:bg-slate-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{t('accountSettings')}</h1>
              <p className="text-blue-100 dark:text-blue-200 mt-1">{t('manageProfile')}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <Link 
                href="/dashboard" 
                className="btn-secondary bg-white/20 hover:bg-white/30 text-white backdrop-blur"
              >
                ← {t('backToDashboard')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* サイドバー */}
          <div className="lg:w-64">
            <div className="card dark:bg-slate-800">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        activeTab === tab.id 
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' 
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                      {activeTab === tab.id && (
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1">
            {/* 成功・エラーメッセージ */}
            {state?.success && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg animate-scaleIn">
                <p className="text-emerald-700 dark:text-emerald-400">{state.message}</p>
              </div>
            )}
            
            {state?.error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-scaleIn">
                <p className="text-red-700 dark:text-red-400">{state.error}</p>
              </div>
            )}

            {/* プロフィールタブ */}
            {activeTab === 'profile' && (
              <div className="card dark:bg-slate-800 animate-fadeIn">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">{t('profileInfo')}</h2>
                
                {/* アバター */}
                <div className="mb-8">
                  <div className="flex items-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                        {userEmail.charAt(0).toUpperCase()}
                      </div>
                      <button className="absolute bottom-0 right-0 bg-white dark:bg-slate-700 rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow">
                        <Camera className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </button>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-white">{initialProfile?.display_name || userEmail.split('@')[0]}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{userEmail}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('userId')}: {userId.slice(0, 8)}...</p>
                    </div>
                  </div>
                </div>
                
                <form action={formAction} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="displayName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <User className="w-4 h-4 inline mr-1" />
                        {t('displayName')}
                      </label>
                      <input
                        type="text"
                        id="displayName"
                        name="displayName"
                        defaultValue={initialProfile?.display_name || ''}
                        className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder={t('displayName')}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-1" />
                        {t('phoneNumber')}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="090-1234-5678"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-slate-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        {t('location')}
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder={t('location')}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="birthday" className="block text-sm font-medium text-slate-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        {t('birthday')}
                      </label>
                      <input
                        type="date"
                        id="birthday"
                        name="birthday"
                        className="input dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-2">
                      {t('bio')}
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      rows={4}
                      defaultValue={initialProfile?.bio || ''}
                      className="input resize-none"
                      placeholder={t('bio')}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <SubmitButton />
                  </div>
                </form>
              </div>
            )}

            {/* 一般設定タブ */}
            {activeTab === 'settings' && (
              <div className="card dark:bg-slate-800 animate-fadeIn">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">{t('generalSettings')}</h2>
                
                <div className="space-y-6">
                  {/* 言語設定 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Globe className="w-4 h-4 inline mr-1" />
                      {t('language')}
                    </label>
                    <select 
                      className="input"
                      value={settings.language}
                      onChange={(e) => setSettings({...settings, language: e.target.value})}
                    >
                      <option value="ja">日本語</option>
                      <option value="en">English</option>
                      <option value="zh">中文</option>
                      <option value="ko">한국어</option>
                    </select>
                  </div>
                  
                  {/* テーマ設定 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Palette className="w-4 h-4 inline mr-1" />
                      {t('theme')}
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="theme"
                          value="light"
                          checked={settings.theme === 'light'}
                          onChange={(e) => setSettings({...settings, theme: e.target.value})}
                          className="mr-2"
                        />
                        <span>{t('lightMode') || 'ライトモード'}</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="theme"
                          value="dark"
                          checked={settings.theme === 'dark'}
                          onChange={(e) => setSettings({...settings, theme: e.target.value})}
                          className="mr-2"
                        />
                        <span>{t('darkMode') || 'ダークモード'}</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="theme"
                          value="auto"
                          checked={settings.theme === 'auto'}
                          onChange={(e) => setSettings({...settings, theme: e.target.value})}
                          className="mr-2"
                        />
                        <span>{t('autoMode') || '自動'}</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 自動翻訳設定 */}
                  <div>
                    <label className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {t('autoTranslateOnUpload') || 'アップロード時に自動翻訳'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSettings({...settings, autoTranslate: !settings.autoTranslate})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.autoTranslate ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.autoTranslate ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                      {t('autoTranslateDescription') || 'ファイルアップロード後、自動的に翻訳処理を開始します'}
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <button className="btn-primary">
                      {t('saveSettings') || '設定を保存'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 通知設定タブ */}
            {activeTab === 'notifications' && (
              <div className="card animate-fadeIn">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">{t('notifications')}</h2>
                
                <div className="space-y-6">
                  {/* メール通知 */}
                  <div>
                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {t('emailNotifications') || 'メール通知'}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          {t('emailNotificationsDescription') || '重要なお知らせをメールで受け取る'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.emailNotifications ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                  </div>
                  
                  {/* プッシュ通知 */}
                  <div>
                    <label className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Bell className="w-4 h-4" />
                          {t('pushNotifications') || 'プッシュ通知'}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">
                          {t('pushNotificationsDescription') || 'ブラウザでリアルタイム通知を受け取る'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings({...settings, pushNotifications: !settings.pushNotifications})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.pushNotifications ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </label>
                  </div>
                  
                  {/* 通知カテゴリ */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-4">通知カテゴリ</h3>
                    <div className="space-y-3">
                      {[
                        { label: '翻訳完了通知', checked: true },
                        { label: 'システムアップデート', checked: true },
                        { label: 'アカウント関連', checked: true },
                        { label: 'プロモーション・お知らせ', checked: false },
                      ].map((item, index) => (
                        <label key={index} className="flex items-center">
                          <input
                            type="checkbox"
                            defaultChecked={item.checked}
                            className="mr-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-600">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <button className="btn-primary">
                      通知設定を保存
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* セキュリティタブ */}
            {activeTab === 'security' && (
              <div className="card animate-fadeIn">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">セキュリティ設定</h2>
                
                <div className="space-y-6">
                  {/* パスワード変更 */}
                  <div className="border-b pb-6">
                    <h3 className="text-sm font-medium text-slate-700 mb-4">パスワード</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      定期的にパスワードを変更することをお勧めします
                    </p>
                    <button className="btn-secondary">
                      パスワードを変更
                    </button>
                  </div>
                  
                  {/* 2段階認証 */}
                  <div className="border-b pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-medium text-slate-700">2段階認証</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          アカウントのセキュリティを強化します
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings({...settings, twoFactorEnabled: !settings.twoFactorEnabled})}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.twoFactorEnabled ? 'bg-blue-600' : 'bg-slate-200'
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                    {settings.twoFactorEnabled && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-blue-800">
                          2段階認証が有効になっています。認証アプリを使用してログイン時に追加の確認を行います。
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* ログインセッション */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-4">アクティブなセッション</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-slate-900">現在のセッション</p>
                          <p className="text-xs text-slate-500">Chrome • 東京, 日本</p>
                        </div>
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">アクティブ</span>
                      </div>
                    </div>
                    <button className="btn-secondary mt-4">
                      すべてのセッションからログアウト
                    </button>
                  </div>
                  
                  {/* アカウント削除 */}
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-red-600 mb-2">危険な操作</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      アカウントを削除すると、すべてのデータが失われます。この操作は取り消せません。
                    </p>
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                      アカウントを削除
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
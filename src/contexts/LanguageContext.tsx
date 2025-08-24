'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ja' | 'en' | 'zh' | 'ko';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ja');
  const [mounted, setMounted] = useState(false);

  // クライアントサイドでのみlocalStorageから言語設定を読み込む
  useEffect(() => {
    const storedLanguage = localStorage.getItem('app-language') as Language;
    if (storedLanguage && ['ja', 'en', 'zh', 'ko'].includes(storedLanguage)) {
      setLanguageState(storedLanguage);
    }
    setMounted(true);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem('app-language', newLanguage);
    // HTML要素のlang属性も更新
    document.documentElement.lang = newLanguage === 'ja' ? 'ja' : 
                                    newLanguage === 'zh' ? 'zh' :
                                    newLanguage === 'ko' ? 'ko' : 'en';
  };

  // マウント前はデフォルト値を返す
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ language: 'ja', setLanguage: () => {} }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
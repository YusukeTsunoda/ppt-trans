// 型定義を一元化して循環参照を解消
import logger from '@/lib/logger';

export type TranslationModel = 
  | 'claude-3-haiku-20240307' 
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-opus-20240229';

export interface Settings {
  translationModel: TranslationModel;
  autoSave: boolean;
  theme: 'light' | 'dark';
  language: 'ja' | 'en';
  batchSize: number;
}

const DEFAULT_SETTINGS: Settings = {
  translationModel: 'claude-3-haiku-20240307',
  autoSave: true,
  theme: 'light',
  language: 'ja',
  batchSize: 5
};

export function getSettings(): Settings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  try {
    const saved = localStorage.getItem('pptx-translator-settings');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    logger.error('Failed to load settings:', e);
  }

  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('pptx-translator-settings', JSON.stringify(settings));
  } catch (e) {
    logger.error('Failed to save settings:', e);
  }
}
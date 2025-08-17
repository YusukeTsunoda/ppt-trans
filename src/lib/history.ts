// 翻訳履歴の管理

import logger from '@/lib/logger';

export interface TranslationHistoryItem {
  id: string;
  fileName: string;
  originalFileUrl?: string;
  translatedFileUrl?: string;
  targetLanguage: string;
  slideCount: number;
  textCount: number;
  translationModel: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;  // 完了時刻（オプション）
  status: 'uploaded' | 'translating' | 'translated' | 'downloaded' | 'failed';  // failedステータス追加
}

const HISTORY_KEY = 'pptx-translator-history';
const MAX_HISTORY_ITEMS = 50; // 最大履歴保存数

// 履歴を取得
export function getTranslationHistory(): TranslationHistoryItem[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored);
    // 日付でソート（新しい順）
    return history.sort((a: TranslationHistoryItem, b: TranslationHistoryItem) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (e) {
    logger.error('Failed to load translation history:', e);
    return [];
  }
}

// 履歴を追加
export function addToHistory(item: Omit<TranslationHistoryItem, 'id' | 'createdAt' | 'updatedAt'>): TranslationHistoryItem {
  const history = getTranslationHistory();
  
  const newItem: TranslationHistoryItem = {
    ...item,
    id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // 最大数を超えたら古いものを削除
  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  } catch (e) {
    logger.error('Failed to save translation history:', e);
    // ストレージが満杯の場合は古い履歴を削除
    try {
      const reducedHistory = updatedHistory.slice(0, 20);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(reducedHistory));
    } catch (e2) {
      logger.error('Failed to save even reduced history:', e2);
    }
  }
  
  return newItem;
}

// 履歴を更新
export function updateHistoryItem(id: string, updates: Partial<TranslationHistoryItem>): void {
  const history = getTranslationHistory();
  const index = history.findIndex(item => item.id === id);
  
  if (index === -1) {
    logger.error('History item not found:', id);
    return;
  }
  
  history[index] = {
    ...history[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    logger.error('Failed to update translation history:', e);
  }
}

// 履歴を削除
export function deleteHistoryItem(id: string): void {
  const history = getTranslationHistory();
  const filtered = history.filter(item => item.id !== id);
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } catch (e) {
    logger.error('Failed to delete history item:', e);
  }
}

// すべての履歴をクリア
export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    logger.error('Failed to clear history:', e);
  }
}

// 履歴アイテムを検索
export function searchHistory(query: string): TranslationHistoryItem[] {
  const history = getTranslationHistory();
  const lowerQuery = query.toLowerCase();
  
  return history.filter(item => 
    item.fileName.toLowerCase().includes(lowerQuery) ||
    item.targetLanguage.toLowerCase().includes(lowerQuery) ||
    item.translationModel.toLowerCase().includes(lowerQuery)
  );
}

// 期間で履歴をフィルタ
export function filterHistoryByDate(startDate: Date, endDate: Date): TranslationHistoryItem[] {
  const history = getTranslationHistory();
  
  return history.filter(item => {
    const itemDate = new Date(item.createdAt);
    return itemDate >= startDate && itemDate <= endDate;
  });
}
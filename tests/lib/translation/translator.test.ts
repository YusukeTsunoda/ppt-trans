import { translateText, detectLanguage, batchTranslate } from '@/lib/translation/translator';

describe('Translator', () => {
  describe('translateText', () => {
    it('テキストを日本語に翻訳する', async () => {
      const result = await translateText('Hello World', 'ja');
      expect(result).toContain('こんにちは');
    });

    it('空のテキストを処理する', async () => {
      const result = await translateText('', 'ja');
      expect(result).toBe('');
    });

    it('既に目標言語の場合はそのまま返す', async () => {
      const result = await translateText('こんにちは', 'ja');
      expect(result).toBe('こんにちは');
    });

    it('サポートされていない言語でエラーを投げる', async () => {
      await expect(translateText('Hello', 'invalid')).rejects.toThrow(
        'サポートされていない言語'
      );
    });
  });

  describe('detectLanguage', () => {
    it('英語を検出する', () => {
      const lang = detectLanguage('Hello World');
      expect(lang).toBe('en');
    });

    it('日本語を検出する', () => {
      const lang = detectLanguage('こんにちは世界');
      expect(lang).toBe('ja');
    });

    it('中国語を検出する', () => {
      const lang = detectLanguage('你好世界');
      expect(lang).toBe('zh');
    });
  });

  describe('batchTranslate', () => {
    it('複数のテキストを一括翻訳する', async () => {
      const texts = ['Hello', 'World', 'Test'];
      const results = await batchTranslate(texts, 'ja');
      
      expect(results).toHaveLength(3);
      expect(results[0]).toContain('こんにちは');
    });

    it('空の配列を処理する', async () => {
      const results = await batchTranslate([], 'ja');
      expect(results).toEqual([]);
    });
  });
});
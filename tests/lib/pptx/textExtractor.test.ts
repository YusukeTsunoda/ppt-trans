import { extractTextFromPPTX, parseExtractedData } from '@/lib/pptx/textExtractor';
import * as fs from 'fs';
import * as path from 'path';

// fsモジュールのモック
jest.mock('fs');

describe('textExtractor', () => {
  describe('extractTextFromPPTX', () => {
    it('PPTXファイルからテキストを抽出する', async () => {
      const mockFilePath = '/tmp/test.pptx';
      const mockExtractedData = {
        slides: [
          {
            slideNumber: 1,
            texts: ['Title', 'Subtitle']
          },
          {
            slideNumber: 2,
            texts: ['Content', 'More content']
          }
        ]
      };

      // Python実行をモック
      const { spawn } = require('child_process');
      jest.mock('child_process', () => ({
        spawn: jest.fn()
      }));

      const result = await extractTextFromPPTX(mockFilePath);

      expect(result).toBeDefined();
      expect(result.slides).toBeInstanceOf(Array);
    });

    it('ファイルが存在しない場合エラーを投げる', async () => {
      const mockFilePath = '/tmp/nonexistent.pptx';

      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(extractTextFromPPTX(mockFilePath)).rejects.toThrow(
        'ファイルが見つかりません'
      );
    });

    it('PPTXファイル以外を拒否する', async () => {
      const mockFilePath = '/tmp/test.pdf';

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await expect(extractTextFromPPTX(mockFilePath)).rejects.toThrow(
        'PPTXファイルのみ対応しています'
      );
    });
  });

  describe('parseExtractedData', () => {
    it('正常なJSONデータをパースする', () => {
      const jsonData = JSON.stringify({
        slides: [
          {
            slideNumber: 1,
            texts: ['Title', 'Content'],
            imageUrl: '/images/slide1.png'
          }
        ],
        totalSlides: 1
      });

      const result = parseExtractedData(jsonData);

      expect(result.slides).toHaveLength(1);
      expect(result.slides[0].slideNumber).toBe(1);
      expect(result.slides[0].texts).toContain('Title');
      expect(result.totalSlides).toBe(1);
    });

    it('不正なJSONでエラーを投げる', () => {
      const invalidJson = '{ invalid json }';

      expect(() => parseExtractedData(invalidJson)).toThrow(
        'データのパースに失敗しました'
      );
    });

    it('必須フィールドが欠けている場合エラーを投げる', () => {
      const incompleteData = JSON.stringify({
        slides: []
        // totalSlidesが欠けている
      });

      expect(() => parseExtractedData(incompleteData)).toThrow(
        '必須フィールドが不足しています'
      );
    });

    it('空のスライドデータを処理する', () => {
      const emptyData = JSON.stringify({
        slides: [],
        totalSlides: 0
      });

      const result = parseExtractedData(emptyData);

      expect(result.slides).toHaveLength(0);
      expect(result.totalSlides).toBe(0);
    });

    it('特殊文字を含むテキストを正しく処理する', () => {
      const specialCharsData = JSON.stringify({
        slides: [
          {
            slideNumber: 1,
            texts: ['Title with "quotes"', 'Content with \n newline'],
            imageUrl: '/images/slide1.png'
          }
        ],
        totalSlides: 1
      });

      const result = parseExtractedData(specialCharsData);

      expect(result.slides[0].texts[0]).toBe('Title with "quotes"');
      expect(result.slides[0].texts[1]).toBe('Content with \n newline');
    });

    it('大量のスライドデータを処理する', () => {
      const slides = Array.from({ length: 100 }, (_, i) => ({
        slideNumber: i + 1,
        texts: [`Slide ${i + 1} Title`, `Slide ${i + 1} Content`],
        imageUrl: `/images/slide${i + 1}.png`
      }));

      const largeData = JSON.stringify({
        slides,
        totalSlides: 100
      });

      const result = parseExtractedData(largeData);

      expect(result.slides).toHaveLength(100);
      expect(result.totalSlides).toBe(100);
      expect(result.slides[99].slideNumber).toBe(100);
    });
  });

  describe('sanitizeText', () => {
    it('HTMLタグを除去する', () => {
      const textWithHtml = 'This is <script>alert("xss")</script> text';
      const sanitized = sanitizeText(textWithHtml);

      expect(sanitized).toBe('This is text');
      expect(sanitized).not.toContain('<script>');
    });

    it('制御文字を除去する', () => {
      const textWithControlChars = 'Text\x00with\x1Fcontrol\x7Fchars';
      const sanitized = sanitizeText(textWithControlChars);

      expect(sanitized).toBe('Textwithcontrolchars');
    });

    it('余分な空白を正規化する', () => {
      const textWithExtraSpaces = '  Multiple   spaces    and\n\nnewlines  ';
      const sanitized = sanitizeText(textWithExtraSpaces);

      expect(sanitized).toBe('Multiple spaces and newlines');
    });

    it('nullやundefinedを安全に処理する', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText('')).toBe('');
    });
  });

  // ヘルパー関数
  function sanitizeText(text: any): string {
    if (!text) return '';
    
    return String(text)
      .replace(/<[^>]*>/g, '') // HTMLタグを除去
      .replace(/[\x00-\x1F\x7F]/g, '') // 制御文字を除去
      .replace(/\s+/g, ' ') // 余分な空白を正規化
      .trim();
  }
});
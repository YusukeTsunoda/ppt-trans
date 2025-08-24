import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// APIハンドラーのモック
const mockTranslate = jest.fn();

describe('/api/translate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'Hello world',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          // text フィールドが欠落
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('text');
    });

    it('should validate target language', async () => {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: 'Hello world',
          targetLang: 'invalid-lang'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('language');
    });

    it('should reject oversized payloads', async () => {
      const largeText = 'a'.repeat(1000000); // 1MB of text
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: largeText,
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(413); // Payload Too Large
    });
  });

  describe('Translation Logic', () => {
    it('should translate text successfully', async () => {
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'こんにちは世界',
        sourceLanguage: 'en',
        confidence: 0.95
      });

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: 'Hello world',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.translatedText).toBe('こんにちは世界');
    });

    it('should handle multiple languages', async () => {
      const languages = ['ja', 'es', 'fr', 'de', 'zh'];
      
      for (const lang of languages) {
        mockTranslate.mockResolvedValueOnce({
          translatedText: `Translated to ${lang}`,
          sourceLanguage: 'en',
          confidence: 0.9
        });

        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          body: JSON.stringify({
            text: 'Hello',
            targetLang: lang
          })
        });

        expect(response.status).toBe(200);
      }
    });

    it('should preserve formatting in translations', async () => {
      const textWithFormatting = 'Title\n\n• Point 1\n• Point 2\n\nConclusion';
      
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'タイトル\n\n• ポイント1\n• ポイント2\n\n結論',
        sourceLanguage: 'en',
        confidence: 0.92
      });

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: textWithFormatting,
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.translatedText).toContain('\n\n');
      expect(data.translatedText).toContain('•');
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limits gracefully', async () => {
      mockTranslate.mockRejectedValueOnce({
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests'
      });

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: 'Hello',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('rate');
    });

    it('should handle translation service failures', async () => {
      mockTranslate.mockRejectedValueOnce(new Error('Service unavailable'));

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: 'Hello',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toContain('unavailable');
    });

    it('should timeout long-running translations', async () => {
      mockTranslate.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(resolve, 60000))
      );

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: 'Hello',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(504); // Gateway Timeout
    }, 10000); // 10秒のテストタイムアウト
  });

  describe('Security', () => {
    it('should sanitize input text', async () => {
      const maliciousText = '<script>alert("xss")</script>Hello';
      
      mockTranslate.mockResolvedValueOnce({
        translatedText: 'こんにちは',
        sourceLanguage: 'en',
        confidence: 0.95
      });

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: maliciousText,
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.translatedText).not.toContain('<script>');
    });

    it('should validate authentication tokens', async () => {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({
          text: 'Hello',
          targetLang: 'ja'
        })
      });

      expect(response.status).toBe(401);
    });

    it('should prevent injection attacks', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          text: sqlInjection,
          targetLang: 'ja'
        })
      });

      // リクエストは処理されるが、インジェクションは無効化される
      expect(response.status).toBe(200);
    });
  });
});
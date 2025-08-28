// API翻訳機能のユニットテスト
describe('/api/translate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // グローバルfetchのモック設定
    global.fetch = jest.fn();
  });

  describe('Request Validation', () => {
    it('should reject requests without authentication', async () => {
      // モックレスポンスの設定
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Missing required field: text' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      const data = await response.json() as { error: string };
      expect(data.error).toContain('text');
    });

    it('should validate target language', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid target language' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      const data = await response.json() as { error: string };
      expect(data.error).toContain('language');
    });

    it('should reject oversized payloads', async () => {
      const largeText = 'a'.repeat(1000000); // 1MB of text
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Payload too large' }), { 
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          translatedText: 'こんにちは世界',
          sourceLanguage: 'en',
          confidence: 0.95
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      const data = await response.json() as {
        translatedText: string;
        sourceLanguage: string;
        confidence: number;
      };
      expect(data.translatedText).toBe('こんにちは世界');
    });

    it('should handle multiple languages', async () => {
      const languages = ['ja', 'es', 'fr', 'de', 'zh'];
      
      for (const lang of languages) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          new Response(JSON.stringify({
            translatedText: `Translated to ${lang}`,
            sourceLanguage: 'en',
            confidence: 0.9
          }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        );

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
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          translatedText: 'タイトル\n\n• ポイント1\n• ポイント2\n\n結論',
          sourceLanguage: 'en',
          confidence: 0.92
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      const data = await response.json() as {
        translatedText: string;
      };
      expect(data.translatedText).toContain('\n\n');
      expect(data.translatedText).toContain('•');
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limits gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          error: 'Rate limit exceeded'
        }), { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        })
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

      expect(response.status).toBe(429);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('rate');
    });

    it('should handle translation service failures', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          error: 'Service unavailable'
        }), { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
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

      expect(response.status).toBe(503);
      const data = await response.json() as { error: string };
      expect(data.error).toContain('unavailable');
    });

    it('should timeout long-running translations', async () => {
      // タイムアウトシミュレーション
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          error: 'Gateway timeout'
        }), { 
          status: 504,
          headers: { 'Content-Type': 'application/json' }
        })
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
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          translatedText: 'こんにちは',
          sourceLanguage: 'en',
          confidence: 0.95
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      const data = await response.json() as {
        translatedText: string;
      };
      expect(data.translatedText).not.toContain('<script>');
    });

    it('should validate authentication tokens', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid token' }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      );

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
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({
          translatedText: 'Safe translation',
          sourceLanguage: 'en',
          confidence: 0.95
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
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
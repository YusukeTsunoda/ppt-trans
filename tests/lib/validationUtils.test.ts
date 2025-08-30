import {
  validatePPTXFile,
  validateTranslationText,
  validateLanguageCode,
  validateURL,
  validateBatchSize,
  validateSlideNumber,
  validateAPIKeys,
  validateTranslationRequest,
  sanitizeText,
  escapeSQL
} from '../../src/lib/validationUtils';

describe('validationUtils', () => {
  describe('validatePPTXFile', () => {
    test('returns invalid when no file provided', () => {
      const result = validatePPTXFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ファイルが選択されていません');
    });

    test('validates PPTX file with correct MIME type', () => {
      const file = new File(['test'], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const result = validatePPTXFile(file);
      expect(result.valid).toBe(true);
    });

    test('validates PPTX file with octet-stream type and .pptx extension', () => {
      const file = new File(['test'], 'test.pptx', {
        type: 'application/octet-stream'
      });
      const result = validatePPTXFile(file);
      expect(result.valid).toBe(true);
    });

    test('rejects non-PPTX files', () => {
      const file = new File(['test'], 'test.pdf', {
        type: 'application/pdf'
      });
      const result = validatePPTXFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('PPTXファイルのみアップロード可能です');
    });

    test('rejects files larger than 100MB', () => {
      const largeContent = new Array(101 * 1024 * 1024).fill('a').join('');
      const file = new File([largeContent], 'test.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const result = validatePPTXFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ファイルサイズは100MB以下にしてください');
    });

    test('rejects files with dangerous characters in filename', () => {
      const file = new File(['test'], 'test<script>.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const result = validatePPTXFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('ファイル名に使用できない文字が含まれています');
    });
  });

  describe('validateTranslationText', () => {
    test('validates normal text', () => {
      const result = validateTranslationText('Hello world');
      expect(result.valid).toBe(true);
    });

    test('rejects empty text', () => {
      const result = validateTranslationText('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('テキストが空です');
    });

    test('rejects text with only whitespace', () => {
      const result = validateTranslationText('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('テキストが空です');
    });

    test('rejects text longer than 100K characters', () => {
      const longText = 'a'.repeat(100001);
      const result = validateTranslationText(longText);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('テキストが長すぎます（最大100000文字）');
    });
  });

  describe('validateLanguageCode', () => {
    test('validates supported languages', () => {
      expect(validateLanguageCode('Japanese')).toBe(true);
      expect(validateLanguageCode('English')).toBe(true);
      expect(validateLanguageCode('Spanish')).toBe(true);
    });

    test('rejects unsupported languages', () => {
      expect(validateLanguageCode('Klingon')).toBe(false);
      expect(validateLanguageCode('InvalidLang')).toBe(false);
    });
  });

  describe('validateURL', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('validates HTTPS URLs in production', () => {
      (process.env as any).NODE_ENV = 'production';
      const result = validateURL('https://example.com');
      expect(result.valid).toBe(true);
    });

    test('rejects HTTP URLs in production', () => {
      (process.env as any).NODE_ENV = 'production';
      const result = validateURL('http://example.com');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('HTTPSのURLのみ使用可能です');
    });

    test('allows HTTP URLs in development', () => {
      (process.env as any).NODE_ENV = 'development';
      const result = validateURL('http://localhost:3000');
      expect(result.valid).toBe(true);
    });

    test('rejects invalid URLs', () => {
      const result = validateURL('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('無効なURL形式です');
    });

    test('validates Supabase URLs', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
      const result = validateURL('https://project.supabase.co/storage/file.pdf');
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBatchSize', () => {
    test('validates valid batch sizes', () => {
      expect(validateBatchSize(1)).toBe(true);
      expect(validateBatchSize(25)).toBe(true);
      expect(validateBatchSize(50)).toBe(true);
    });

    test('rejects invalid batch sizes', () => {
      expect(validateBatchSize(0)).toBe(false);
      expect(validateBatchSize(51)).toBe(false);
      expect(validateBatchSize(-1)).toBe(false);
    });
  });

  describe('validateSlideNumber', () => {
    test('validates slide numbers within range', () => {
      expect(validateSlideNumber(1, 10)).toBe(true);
      expect(validateSlideNumber(5, 10)).toBe(true);
      expect(validateSlideNumber(10, 10)).toBe(true);
    });

    test('rejects slide numbers outside range', () => {
      expect(validateSlideNumber(0, 10)).toBe(false);
      expect(validateSlideNumber(11, 10)).toBe(false);
      expect(validateSlideNumber(-1, 10)).toBe(false);
    });
  });

  describe('validateAPIKeys', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('validates when all required keys are present', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const result = validateAPIKeys();
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    test('reports missing API keys', () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const result = validateAPIKeys();
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('ANTHROPIC_API_KEY');
      expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
    });
  });

  describe('validateTranslationRequest', () => {
    test('validates correct translation request', () => {
      const request = {
        texts: [
          { id: '1', original: 'Hello world' },
          { id: '2', original: 'Good morning' }
        ],
        targetLanguage: 'Japanese'
      };

      const result = validateTranslationRequest(request);
      expect(result.valid).toBe(true);
      expect(result.data).toEqual(request);
    });

    test('rejects invalid request format', () => {
      const result = validateTranslationRequest(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid request format');
    });

    test('rejects empty texts array', () => {
      const request = {
        texts: [],
        targetLanguage: 'Japanese'
      };

      const result = validateTranslationRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('texts must be a non-empty array');
    });

    test('rejects invalid language', () => {
      const request = {
        texts: [{ id: '1', original: 'Hello' }],
        targetLanguage: 'InvalidLanguage'
      };

      const result = validateTranslationRequest(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid target language');
    });

    test('validates model parameter', () => {
      const request = {
        texts: [{ id: '1', original: 'Hello' }],
        targetLanguage: 'Japanese',
        model: 'claude-3-haiku-20240307'
      };

      const result = validateTranslationRequest(request);
      expect(result.valid).toBe(true);
      expect(result.data?.model).toBe('claude-3-haiku-20240307');
    });
  });

  describe('sanitizeText', () => {
    test('escapes HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;';
      expect(sanitizeText(input)).toBe(expected);
    });

    test('escapes single quotes', () => {
      const input = "It's a test";
      const expected = "It&#x27;s a test";
      expect(sanitizeText(input)).toBe(expected);
    });

    test('handles normal text', () => {
      const input = 'Hello world';
      expect(sanitizeText(input)).toBe('Hello world');
    });
  });

  describe('escapeSQL', () => {
    test('escapes single quotes', () => {
      const input = "O'Reilly";
      const expected = "O''Reilly";
      expect(escapeSQL(input)).toBe(expected);
    });

    test('handles multiple single quotes', () => {
      const input = "It's a 'test'";
      const expected = "It''s a ''test''";
      expect(escapeSQL(input)).toBe(expected);
    });

    test('handles normal text', () => {
      const input = 'Hello world';
      expect(escapeSQL(input)).toBe('Hello world');
    });
  });
});
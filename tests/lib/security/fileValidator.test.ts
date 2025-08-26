import { validateFile, validateFileSize, validateFileType } from '@/lib/security/fileValidator';

describe('FileValidator', () => {
  describe('validateFileSize', () => {
    it('10MB以下のファイルを許可する', () => {
      const file = new File(['test'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // 5MB

      const result = validateFileSize(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('10MBを超えるファイルを拒否する', () => {
      const file = new File(['test'], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 }); // 11MB

      const result = validateFileSize(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('ファイルサイズは10MB以下にしてください');
    });

    it('0バイトのファイルを拒否する', () => {
      const file = new File([''], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      Object.defineProperty(file, 'size', { value: 0 });

      const result = validateFileSize(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('ファイルが空です');
    });
  });

  describe('validateFileType', () => {
    it('PPTXファイルを許可する', () => {
      const file = new File(['test'], 'test.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('PPTファイルを許可する', () => {
      const file = new File(['test'], 'test.ppt', { 
        type: 'application/vnd.ms-powerpoint' 
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('PDFファイルを拒否する', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      const result = validateFileType(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('PowerPointファイル（.ppt, .pptx）のみアップロード可能です');
    });

    it('拡張子とMIMEタイプの不一致を検出する', () => {
      const file = new File(['test'], 'test.pptx', { type: 'application/pdf' });

      const result = validateFileType(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('ファイルタイプが不正です');
    });
  });

  describe('validateFile', () => {
    it('有効なPPTXファイルを許可する', () => {
      const file = new File(['test content'], 'presentation.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
      Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 }); // 5MB

      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('ファイル名にXSS攻撃パターンを検出する', () => {
      const file = new File(['test'], '<script>alert("xss")</script>.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('セキュリティ');
    });

    it('ファイル名にSQLインジェクション攻撃パターンを検出する', () => {
      const file = new File(['test'], "test'; DROP TABLE users;--.pptx", { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('セキュリティ');
    });

    it('長すぎるファイル名を拒否する', () => {
      const longName = 'a'.repeat(256) + '.pptx';
      const file = new File(['test'], longName, { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('ファイル名が長すぎます');
    });

    it('日本語ファイル名を許可する', () => {
      const file = new File(['test'], 'プレゼンテーション.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('特殊文字を含むファイル名を適切に処理する', () => {
      const file = new File(['test'], 'test-presentation_2024.pptx', { 
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 }); // 1MB

      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
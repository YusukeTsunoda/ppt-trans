/**
 * 入力検証ユーティリティ
 * APIエンドポイントやフォームの入力検証を統一
 */

/**
 * ファイルタイプの検証
 */
export function validatePPTXFile(file: File | null): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'ファイルが選択されていません' };
  }

  // MIMEタイプの確認
  const validMimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/octet-stream' // 一部のブラウザではこれになる場合がある
  ];

  if (!validMimeTypes.includes(file.type) && !file.name.endsWith('.pptx')) {
    return { 
      valid: false, 
      error: 'PPTXファイルのみアップロード可能です' 
    };
  }

  // ファイルサイズの確認（50MB制限）
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: 'ファイルサイズは50MB以下にしてください' 
    };
  }

  // ファイル名の検証（危険な文字を除外）
  const dangerousChars = /[<>:"|?*\x00-\x1f]/g;
  if (dangerousChars.test(file.name)) {
    return { 
      valid: false, 
      error: 'ファイル名に使用できない文字が含まれています' 
    };
  }

  return { valid: true };
}

/**
 * 翻訳テキストの検証
 */
export function validateTranslationText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'テキストが空です' };
  }

  // 最大文字数制限（Claude APIの制限を考慮）
  const maxLength = 100000; // 100K文字
  if (text.length > maxLength) {
    return { 
      valid: false, 
      error: `テキストが長すぎます（最大${maxLength}文字）` 
    };
  }

  return { valid: true };
}

/**
 * 言語コードの検証
 */
export function validateLanguageCode(code: string): boolean {
  const validLanguages = [
    'Japanese', 'English', 'Chinese', 'Korean', 
    'Spanish', 'French', 'German', 'Italian',
    'Portuguese', 'Russian', 'Arabic', 'Hindi'
  ];
  
  return validLanguages.includes(code);
}

/**
 * URLの検証
 */
export function validateURL(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    // HTTPSのみ許可（開発環境ではHTTPも許可）
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return { 
        valid: false, 
        error: 'HTTPSのURLのみ使用可能です' 
      };
    }

    // Supabase URLの場合は追加検証
    if (url.includes('supabase')) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && !url.startsWith(supabaseUrl)) {
        return { 
          valid: false, 
          error: '不正なSupabase URLです' 
        };
      }
    }

    return { valid: true };
  } catch {
    return { 
      valid: false, 
      error: '無効なURL形式です' 
    };
  }
}

/**
 * バッチサイズの検証
 */
export function validateBatchSize(size: number): boolean {
  return size >= 1 && size <= 50;
}

/**
 * スライド番号の検証
 */
export function validateSlideNumber(
  slideNumber: number, 
  totalSlides: number
): boolean {
  return slideNumber >= 1 && slideNumber <= totalSlides;
}

/**
 * APIキーの検証（環境変数）
 */
export function validateAPIKeys(): { 
  valid: boolean; 
  missing: string[] 
} {
  const required = [
    'ANTHROPIC_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * 翻訳リクエストの検証
 */
export interface TranslationRequest {
  texts: Array<{
    id: string;
    original: string;
  }>;
  targetLanguage: string;
  model?: string;
}

export function validateTranslationRequest(
  req: any
): { valid: boolean; error?: string; data?: TranslationRequest } {
  // 基本的な型チェック
  if (!req || typeof req !== 'object') {
    return { valid: false, error: 'Invalid request format' };
  }

  // texts配列の検証
  if (!Array.isArray(req.texts) || req.texts.length === 0) {
    return { valid: false, error: 'texts must be a non-empty array' };
  }

  // 各テキストアイテムの検証
  for (const item of req.texts) {
    if (!item.id || typeof item.id !== 'string') {
      return { valid: false, error: 'Each text must have a valid id' };
    }
    
    if (!item.original || typeof item.original !== 'string') {
      return { valid: false, error: 'テキストが空です' };
    }
    
    const textValidation = validateTranslationText(item.original);
    if (!textValidation.valid) {
      return { valid: false, error: textValidation.error };
    }
  }

  // 言語コードの検証
  if (!req.targetLanguage || !validateLanguageCode(req.targetLanguage)) {
    return { valid: false, error: 'Invalid target language' };
  }

  // モデルの検証（オプション）
  const validModels = [
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229',
    'claude-3-opus-20240229',
    'claude-3-5-sonnet-20241022'
  ];

  if (req.model && !validModels.includes(req.model)) {
    return { valid: false, error: 'Invalid model specified' };
  }

  return {
    valid: true,
    data: {
      texts: req.texts,
      targetLanguage: req.targetLanguage,
      model: req.model
    }
  };
}

/**
 * セキュリティ: XSS攻撃を防ぐためのテキストサニタイズ
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * セキュリティ: SQLインジェクション対策用のエスケープ
 */
export function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}
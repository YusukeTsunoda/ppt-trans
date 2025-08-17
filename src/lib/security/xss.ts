import DOMPurify from 'isomorphic-dompurify';
import type { Config } from 'dompurify';
import logger from '@/lib/logger';
import type { JsonObject } from '@/types/common';

/**
 * XSS対策のためのサニタイザー
 */
export class XSSProtection {
  /**
   * HTML文字列をサニタイズ
   */
  static sanitizeHTML(dirty: string, options?: Config): string {
    try {
      // デフォルト設定
      const defaultConfig: Config = {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      };
      
      // オプションがある場合はマージ
      const config: Config = options ? { ...defaultConfig, ...options } : defaultConfig;
      
      const clean = DOMPurify.sanitize(dirty, config) as string;
      
      // サニタイズで変更があった場合はログに記録
      if (clean !== dirty) {
        logger.warn('XSS attempt detected and sanitized', {
          original: dirty.substring(0, 100),
          sanitized: clean.substring(0, 100),
        });
      }
      
      return clean;
    } catch (error) {
      logger.error('HTML sanitization error', error);
      return '';
    }
  }
  
  /**
   * テキストをHTMLエスケープ
   */
  static escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * URLをサニタイズ
   */
  static sanitizeURL(url: string): string | null {
    try {
      const parsed = new URL(url);
      
      // 許可されたプロトコルのみ
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(parsed.protocol)) {
        logger.warn('Unsafe URL protocol detected', { 
          url,
          protocol: parsed.protocol,
        });
        return null;
      }
      
      // JavaScriptスキームをブロック
      if (url.toLowerCase().includes('javascript:')) {
        logger.warn('JavaScript URL detected', { url });
        return null;
      }
      
      // データURIをブロック（画像以外）
      if (parsed.protocol === 'data:' && !url.startsWith('data:image/')) {
        logger.warn('Unsafe data URI detected', { url });
        return null;
      }
      
      return parsed.toString();
    } catch (error) {
      logger.debug('Invalid URL', { url, error });
      return null;
    }
  }
  
  /**
   * JSONデータをサニタイズ
   */
  static sanitizeJSON<T extends JsonObject>(data: T): T {
    const sanitized: JsonObject = {};
    
    for (const [key, value] of Object.entries(data)) {
      // キーをサニタイズ
      const sanitizedKey = this.sanitizeString(key);
      
      // 値をサニタイズ
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map(item => 
          typeof item === 'string' ? this.sanitizeString(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[sanitizedKey] = this.sanitizeJSON(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }
    
    return sanitized as T;
  }
  
  /**
   * 文字列をサニタイズ（基本的なXSS対策）
   */
  static sanitizeString(str: string): string {
    if (!str) return '';
    
    return str
      .replace(/[<>]/g, '') // HTMLタグを削除
      .replace(/javascript:/gi, '') // JavaScriptスキームを削除
      .replace(/on\w+\s*=/gi, '') // イベントハンドラを削除
      .trim();
  }
  
  /**
   * SVGをサニタイズ
   */
  static sanitizeSVG(svgString: string): string {
    const config: Config = {
      USE_PROFILES: { svg: true },
      KEEP_CONTENT: false,
      FORBID_TAGS: ['script', 'animate', 'animateTransform', 'set'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
    };
    
    return DOMPurify.sanitize(svgString, config) as string;
  }
  
  /**
   * ファイル名をサニタイズ
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // 英数字、ピリオド、ハイフン、アンダースコア以外を置換
      .replace(/\.{2,}/g, '.') // 連続するピリオドを単一に
      .replace(/^\.+|\.+$/g, ''); // 先頭と末尾のピリオドを削除
  }
  
  /**
   * Content Security Policy (CSP) ヘッダーを生成
   */
  static generateCSP(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net", // Next.jsのため一部許可
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self'",
      "connect-src 'self' https://api.anthropic.com https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ];
    
    return directives.join('; ');
  }
  
  /**
   * クッキーをセキュアに設定
   */
  static getSecureCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    maxAge?: number;
    path: string;
  } {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24時間
      path: '/',
    };
  }
}

/**
 * React コンポーネント用のサニタイズフック
 */
export function useSanitizedHTML(
  dirty: string,
  options?: Config
): { __html: string } {
  const sanitized = XSSProtection.sanitizeHTML(dirty, options);
  return { __html: sanitized };
}

/**
 * 入力値のバリデーションとサニタイゼーション
 */
export class InputValidator {
  /**
   * メールアドレスの検証
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }
  
  /**
   * パスワードの検証
   */
  static isValidPassword(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * ユーザー名の検証
   */
  static isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
    return usernameRegex.test(username);
  }
  
  /**
   * 電話番号の検証
   */
  static isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\d\s+()-]+$/;
    return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
  }
  
  /**
   * URLの検証
   */
  static isValidURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
  
  /**
   * 数値の範囲検証
   */
  static isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }
  
  /**
   * 文字列長の検証
   */
  static isValidLength(str: string, min: number, max: number): boolean {
    const length = str.trim().length;
    return length >= min && length <= max;
  }
}
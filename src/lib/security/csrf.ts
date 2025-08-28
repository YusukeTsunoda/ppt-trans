import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const CSRF_TOKEN_NAME = 'csrf-token';
export const CSRF_META_TOKEN_NAME = 'csrf-token-meta';  // httpOnlyメタトークン
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;
const DEFAULT_TOKEN_MAX_AGE = 60 * 60 * 4; // デフォルト4時間（セキュリティ強化）

export class CSRFProtection {
  /**
   * CSRFトークンを生成し、Cookieに設定（セキュリティ強化版）
   * @param options 設定オプション
   */
  static async generateToken(options?: {
    maxAge?: number;
    doubleSubmit?: boolean;
  }): Promise<string> {
    const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = options?.maxAge || DEFAULT_TOKEN_MAX_AGE;
    
    // メタトークン（httpOnly - XSS対策強化）
    cookieStore.set(CSRF_META_TOKEN_NAME, token, {
      httpOnly: true,  // XSS攻撃から保護
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
    
    // Double Submit Cookie用トークン（JavaScriptから読み取り可能）
    if (options?.doubleSubmit !== false) {
      cookieStore.set(CSRF_TOKEN_NAME, token, {
        httpOnly: false,  // Double Submit Cookieパターンに必要
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge,
      });
    }
    
    return token;
  }

  /**
   * 既存のトークンを取得、なければ生成
   */
  static async getOrGenerateToken(options?: {
    maxAge?: number;
    doubleSubmit?: boolean;
  }): Promise<string> {
    const cookieStore = await cookies();
    // Double Submitトークンをチェック（後方互換性）
    const existingToken = cookieStore.get(CSRF_TOKEN_NAME);
    // メタトークンもチェック
    const existingMetaToken = cookieStore.get(CSRF_META_TOKEN_NAME);
    
    // 両方のトークンが存在する場合はそのまま返す
    if (existingToken?.value && existingMetaToken?.value) {
      return existingToken.value;
    }
    
    // どちらかが欠けている場合は再生成
    return this.generateToken(options);
  }

  /**
   * CSRFトークンを検証（セキュリティ強化版）
   */
  static async verifyToken(request: NextRequest): Promise<boolean> {
    // GET/HEADリクエストはスキップ
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    try {
      // 1. メタトークン（httpOnly）の確認 - 最も重要
      const metaToken = request.cookies.get(CSRF_META_TOKEN_NAME)?.value;
      if (!metaToken) {
        console.error('[CSRF] No meta token in secure cookie');
        // 後方互換性のため、古い実装もチェック
        const legacyToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
        if (!legacyToken) {
          return false;
        }
        // レガシートークンのみの場合も許可（移行期間）
        console.warn('[CSRF] Using legacy token validation - consider updating client');
      }

      // 2. クライアント側トークンの取得（優先順位: Header > Cookie > Body）
      const headerToken = request.headers.get(CSRF_HEADER_NAME);
      const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
      
      // ボディトークンのチェック（フォールバック）
      let bodyToken: string | null = null;
      if (request.headers.get('content-type')?.includes('application/json')) {
        try {
          const body = await request.clone().json();
          bodyToken = body._csrf;
        } catch {
          // JSON解析エラーは無視
        }
      }
      
      // 優先順位: Header > Cookie > Body
      const clientToken = headerToken || cookieToken || bodyToken;
      
      if (!clientToken) {
        console.error('[CSRF] No client token found');
        return false;
      }

      // 3. トークン比較（メタトークンが存在する場合はそれを使用）
      const tokenToCompare = metaToken || cookieToken || '';
      
      // 4. セキュアな比較（タイミング攻撃対策）
      if (!this.secureCompare(tokenToCompare, clientToken)) {
        console.error('[CSRF] Token mismatch');
        // セキュリティログ記録
        console.warn('[CSRF Security Event]', {
          path: request.url,
          method: request.method,
          hasMetaToken: !!metaToken,
          hasClientToken: !!clientToken,
          tokenSource: headerToken ? 'header' : cookieToken ? 'cookie' : 'body'
        });
        return false;
      }

      // 5. トークンの長さ検証
      if (clientToken.length !== CSRF_TOKEN_LENGTH * 2) {
        console.error('[CSRF] Invalid token length');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[CSRF] Validation error:', error);
      return false;
    }
  }

  /**
   * 定時間比較（タイミング攻撃対策）
   */
  private static secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

// 便利なエクスポート関数（後方互換性維持）
export const generateCSRFToken = async (options?: {
  maxAge?: number;
  doubleSubmit?: boolean;
}) => CSRFProtection.generateToken(options);

export const validateCSRFToken = async (request: NextRequest) => 
  CSRFProtection.verifyToken(request);

export const getCSRFToken = async () => CSRFProtection.getOrGenerateToken();

// Next.js Server Actions用のトークン設定
export function setCSRFToken(response: NextResponse, options?: {
  rotationInterval?: number;
  doubleSubmit?: boolean;
}): string {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = options?.rotationInterval || DEFAULT_TOKEN_MAX_AGE;
  
  // メタトークン（httpOnly）として保存
  response.cookies.set(CSRF_META_TOKEN_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge,
  });
  
  // Double Submit用トークン
  if (options?.doubleSubmit !== false) {
    response.cookies.set(CSRF_TOKEN_NAME, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge,
    });
  }
  
  return token;
}

// クライアント側でCSRF付きfetchを行うためのヘルパー関数
export async function fetchWithCSRF(
  url: string,
  options?: RequestInit
): Promise<Response> {
  // Cookieからトークンを取得
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue || null;
    }
    return null;
  };

  const token = getCookie(CSRF_TOKEN_NAME);
  
  if (!token) {
    console.warn('[CSRF] No token found in cookie for fetch');
  }

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  headers.set('X-Requested-With', 'XMLHttpRequest'); // AJAX識別用

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Cookieを含める
  });
}
'use client';

import { useState, useEffect } from 'react';

/**
 * CSRFトークンを管理するフック
 * フォーム送信前にこのフックを使用してトークンを取得
 */
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCSRFToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include', // Cookieを含める
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      
      const data = await response.json();
      
      if (data.success && data.csrfToken) {
        setCSRFToken(data.csrfToken);
        return data.csrfToken;
      } else {
        throw new Error(data.error || 'Invalid CSRF token response');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'CSRFトークンの取得に失敗しました';
      setError(errorMessage);
      console.error('CSRF token fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // コンポーネントマウント時にトークンを取得
    fetchCSRFToken();
  }, []);

  // トークンをリフレッシュする関数
  const refreshToken = () => {
    return fetchCSRFToken();
  };

  return {
    csrfToken,
    loading,
    error,
    refreshToken,
  };
}

/**
 * APIリクエスト用のヘルパー関数
 * CSRFトークンを自動的に含める
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // CSRFトークンを取得
  const tokenResponse = await fetch('/api/auth/csrf', {
    method: 'GET',
    credentials: 'include',
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  
  const { csrfToken } = await tokenResponse.json();
  
  // リクエストヘッダーにCSRFトークンを追加
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', csrfToken);
  
  // Content-Typeを設定（JSONの場合）
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Cookieを含める
  });
}
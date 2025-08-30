'use client';

import { useEffect, useState } from 'react';

let csrfToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

/**
 * CSRFトークンをシングルトンパターンで管理
 * 全てのクライアントコンポーネントで共有
 */
export async function getCSRFToken(): Promise<string> {
  // 既にトークンがある場合はそれを返す
  if (csrfToken) {
    return csrfToken;
  }

  // トークン取得中の場合は同じPromiseを返す
  if (tokenPromise) {
    return tokenPromise;
  }

  // 新しくトークンを取得
  tokenPromise = fetchCSRFToken();
  csrfToken = await tokenPromise;
  tokenPromise = null;
  
  return csrfToken;
}

async function fetchCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/auth/csrf', {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.csrfToken) {
      throw new Error('CSRF token not found in response');
    }

    return data.csrfToken;
  } catch (error) {
    console.error('CSRF token fetch error:', error);
    throw error;
  }
}

/**
 * CSRFトークンを含めたfetch関数
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCSRFToken();
  
  const headers = new Headers(options.headers);
  headers.set('X-CSRF-Token', token);
  
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * CSRFトークンをプリフェッチするフック
 * アプリケーション起動時に使用
 */
export function useCSRFToken() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getCSRFToken()
      .then(() => setLoading(false))
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { loading, error };
}

/**
 * トークンをリセット（ログアウト時などに使用）
 */
export function resetCSRFToken() {
  csrfToken = null;
  tokenPromise = null;
}
// Client-side CSRF utilities
// This file does NOT import next/headers and is safe for client components

export const CSRF_TOKEN_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Client-side helper to get cookie value
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue || null;
  }
  return null;
}

// Client-side fetch with CSRF token
export async function fetchWithCSRF(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const token = getCookie(CSRF_TOKEN_NAME);
  
  if (!token) {
    console.warn('[CSRF] No token found in cookie for fetch');
  }

  const headers = new Headers(options?.headers);
  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  headers.set('X-Requested-With', 'XMLHttpRequest'); // AJAX identification

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  });
}
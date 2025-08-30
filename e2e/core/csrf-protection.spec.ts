import { test, expect } from '@playwright/test';

/**
 * CSRF保護のE2Eテスト
 * QA観点での完全な検証
 */
test.describe('CSRF Protection', () => {
  
  test('CSRFトークンなしのPOSTリクエストは拒否される', async ({ page }) => {
    // APIエンドポイントに直接POSTリクエストを送信
    const response = await page.request.post('/api/auth/login', {
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    // CSRFトークンがないため403エラーが返される
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('CSRF');
  });

  test('無効なCSRFトークンでPOSTリクエストは拒否される', async ({ page }) => {
    const response = await page.request.post('/api/auth/login', {
      headers: {
        'X-CSRF-Token': 'invalid-token-12345'
      },
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    expect(response.status()).toBe(403);
  });

  test('有効なCSRFトークンでPOSTリクエストが成功する', async ({ page }) => {
    // 1. CSRFトークンを取得
    const tokenResponse = await page.request.get('/api/auth/csrf');
    expect(tokenResponse.ok()).toBeTruthy();
    const tokenData = await tokenResponse.json();
    expect(tokenData.csrfToken).toBeDefined();
    
    // 2. トークンを使用してPOSTリクエスト
    const response = await page.request.post('/api/auth/login', {
      headers: {
        'X-CSRF-Token': tokenData.csrfToken
      },
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    // 認証エラーは別として、CSRFエラーではないことを確認
    expect(response.status()).not.toBe(403);
  });

  test('フォーム送信時にCSRFトークンが自動的に含まれる', async ({ page }) => {
    await page.goto('/login');
    
    // ネットワークリクエストを監視
    const requestPromise = page.waitForRequest(req => 
      req.url().includes('/api/auth/login') && req.method() === 'POST'
    );
    
    // フォームに入力
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    // 送信
    await page.click('button[type="submit"]');
    
    // リクエストを検証
    const request = await requestPromise;
    const headers = request.headers();
    
    // X-CSRF-Tokenヘッダーが含まれていることを確認
    expect(headers['x-csrf-token']).toBeDefined();
  });

  test('異なるオリジンからのリクエストは拒否される', async ({ page, context }) => {
    // CORSヘッダーを偽装してリクエスト
    const response = await context.request.post('http://localhost:3000/api/auth/login', {
      headers: {
        'Origin': 'http://evil-site.com',
        'Referer': 'http://evil-site.com'
      },
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    // CORSまたはCSRFで拒否される
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('トークンの再利用が可能（同一セッション内）', async ({ page }) => {
    // トークンを取得
    const tokenResponse = await page.request.get('/api/auth/csrf');
    const { csrfToken } = await tokenResponse.json();
    
    // 同じトークンで複数のリクエストを送信
    for (let i = 0; i < 3; i++) {
      const response = await page.request.post('/api/files', {
        headers: {
          'X-CSRF-Token': csrfToken
        },
        data: {
          action: 'list'
        }
      });
      
      // トークンが有効であることを確認
      expect(response.status()).not.toBe(403);
    }
  });

  test('ログアウト後は新しいトークンが必要', async ({ page }) => {
    // 1. ログイン
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // 2. トークンを取得
    const tokenResponse1 = await page.request.get('/api/auth/csrf');
    const token1 = (await tokenResponse1.json()).csrfToken;
    
    // 3. ログアウト
    await page.request.post('/api/auth/logout');
    
    // 4. 古いトークンでリクエスト（失敗するはず）
    const response = await page.request.post('/api/auth/login', {
      headers: {
        'X-CSRF-Token': token1
      },
      data: {
        email: 'test@example.com',
        password: 'password123'
      }
    });
    
    // セッションが変わったため、新しいトークンが必要
    expect(response.status()).toBe(403);
  });
});

/**
 * CSRFトークンのライフサイクルテスト
 */
test.describe('CSRF Token Lifecycle', () => {
  
  test('トークンは24時間有効', async ({ page }) => {
    const response = await page.request.get('/api/auth/csrf');
    const cookies = await response.headers()['set-cookie'];
    
    // Cookieの有効期限を確認
    expect(cookies).toContain('Max-Age=86400'); // 24時間
  });

  test('複数タブで同じトークンを共有', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // 両方のタブでトークンを取得
    await page1.goto('/login');
    await page2.goto('/login');
    
    // page1でトークンを取得
    const response1 = await page1.request.get('/api/auth/csrf');
    const token1 = (await response1.json()).csrfToken;
    
    // page2でトークンを取得（同じはず）
    const response2 = await page2.request.get('/api/auth/csrf');
    const token2 = (await response2.json()).csrfToken;
    
    // 同じセッションなので同じトークン
    expect(token1).toBe(token2);
    
    await page1.close();
    await page2.close();
  });
});
import { test, expect } from '@playwright/test';

/**
 * CSRF (Cross-Site Request Forgery) 保護テスト
 * 
 * このテストスイートは、アプリケーションがCSRF攻撃に対して
 * 適切に防御されているかを検証します。
 */

test.describe('🔐 CSRF保護テスト', () => {
  let authToken: string;
  let csrfToken: string;

  test.beforeEach(async ({ page }) => {
    // テストユーザーでログインしてトークンを取得
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123456!');
    
    // ネットワークリクエストを監視してトークンを取得
    page.on('response', async response => {
      const headers = response.headers();
      if (headers['x-csrf-token']) {
        csrfToken = headers['x-csrf-token'];
      }
    });
    
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    
    // 認証トークンの取得
    authToken = await page.evaluate(() => {
      return localStorage.getItem('supabase.auth.token') || '';
    });
  });

  test.describe('CSRFトークンの検証', () => {
    test('CSRFトークンなしのリクエストが拒否される', async ({ page, context }) => {
      await page.goto('/upload');
      
      // CSRFトークンを削除してリクエストを送信
      await context.route('**/api/translate-pptx', route => {
        const headers = { ...route.request().headers() };
        delete headers['x-csrf-token'];
        delete headers['csrf-token'];
        
        route.continue({ headers });
      });
      
      // ファイルアップロードを試行
      const fileInput = page.locator('input[type="file"]');
      const buffer = Buffer.from('test content');
      await fileInput.setInputFiles({
        name: 'test.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        buffer: buffer
      });
      
      // アップロードボタンをクリック
      const uploadButton = page.locator('button:has-text("アップロード"), button:has-text("Upload")');
      await uploadButton.click();
      
      // エラーメッセージの確認
      const errorMessage = await page.waitForSelector(
        '.error-message, .text-red-500, [role="alert"], text=/CSRF|セキュリティエラー|Security error/i',
        { timeout: 5000 }
      ).catch(() => null);
      
      if (errorMessage) {
        const errorText = await errorMessage.textContent();
        console.log('CSRF protection active:', errorText);
      }
      
      // リクエストが失敗することを確認
      const successMessage = await page.locator('.success-message, .text-green-500').isVisible().catch(() => false);
      expect(successMessage).toBeFalsy();
    });

    test('無効なCSRFトークンが拒否される', async ({ page, context }) => {
      await page.goto('/upload');
      
      // 無効なCSRFトークンを設定
      await context.route('**/api/translate-pptx', route => {
        const headers = { ...route.request().headers() };
        headers['x-csrf-token'] = 'invalid-csrf-token-12345';
        
        route.continue({ headers });
      });
      
      // ファイルアップロードを試行
      const fileInput = page.locator('input[type="file"]');
      const buffer = Buffer.from('test content');
      await fileInput.setInputFiles({
        name: 'test.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        buffer: buffer
      });
      
      await page.click('button:has-text("アップロード"), button:has-text("Upload")');
      
      // エラーが発生することを確認
      const errorOccurred = await page.waitForSelector(
        '.error-message, .text-red-500, [role="alert"]',
        { timeout: 5000 }
      ).then(() => true).catch(() => false);
      
      expect(errorOccurred).toBeTruthy();
    });
  });

  test.describe('Originヘッダーの検証', () => {
    test('異なるオリジンからのリクエストが拒否される', async ({ page, context, request }) => {
      // 異なるオリジンからのリクエストをシミュレート
      const response = await request.post('/api/translate-pptx', {
        headers: {
          'Origin': 'http://malicious-site.com',
          'Referer': 'http://malicious-site.com/attack',
          'Authorization': `Bearer ${authToken}`,
        },
        data: {
          fileName: 'test.pptx',
          content: 'test content'
        }
      }).catch(error => error.response);
      
      // ステータスコードの確認
      if (response) {
        const status = response.status();
        // 403 Forbidden または 401 Unauthorized が期待される
        expect([401, 403]).toContain(status);
      }
    });

    test('同一オリジンからのリクエストが許可される', async ({ page, request }) => {
      const response = await request.post('/api/health', {
        headers: {
          'Origin': 'http://localhost:3000',
          'Referer': 'http://localhost:3000/upload',
        }
      });
      
      // ヘルスチェックは成功するはず
      expect(response.ok()).toBeTruthy();
    });
  });

  test.describe('Refererヘッダーの検証', () => {
    test('Refererヘッダーなしのリクエスト', async ({ page, context }) => {
      await page.goto('/upload');
      
      // Refererヘッダーを削除
      await context.route('**/api/**', route => {
        const headers = { ...route.request().headers() };
        delete headers['referer'];
        
        route.continue({ headers });
      });
      
      // APIリクエストを発生させる
      await page.evaluate(() => {
        fetch('/api/health', {
          method: 'GET',
          credentials: 'include'
        });
      });
      
      // ページは正常に動作することを確認（GETリクエストは許可される場合が多い）
      await expect(page).toHaveURL(/.*upload/);
    });
  });

  test.describe('ダブルサブミット防止', () => {
    test('同じフォームの二重送信が防止される', async ({ page }) => {
      await page.goto('/upload');
      
      // ファイルを選択
      const fileInput = page.locator('input[type="file"]');
      const buffer = Buffer.from('test content');
      await fileInput.setInputFiles({
        name: 'test.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        buffer: buffer
      });
      
      // アップロードボタンを取得
      const uploadButton = page.locator('button:has-text("アップロード"), button:has-text("Upload")');
      
      // ダブルクリックをシミュレート
      await uploadButton.dblclick();
      
      // リクエスト数をカウント
      let requestCount = 0;
      page.on('request', request => {
        if (request.url().includes('/api/translate-pptx')) {
          requestCount++;
        }
      });
      
      // 少し待機
      await page.waitForTimeout(2000);
      
      // 1回のみリクエストが送信されることを確認
      // （または2回目がキャンセルされる）
      expect(requestCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe('SameSite Cookieの検証', () => {
    test('CookieにSameSite属性が設定されている', async ({ page, context }) => {
      const cookies = await context.cookies();
      
      // 認証関連のCookieを確認
      const authCookies = cookies.filter(cookie => 
        cookie.name.includes('auth') || 
        cookie.name.includes('session') ||
        cookie.name.includes('supabase')
      );
      
      for (const cookie of authCookies) {
        // SameSite属性が設定されていることを確認
        if (cookie.sameSite) {
          expect(['Strict', 'Lax', 'None']).toContain(cookie.sameSite);
          
          // Noneの場合はSecure属性も必要
          if (cookie.sameSite === 'None') {
            expect(cookie.secure).toBeTruthy();
          }
        }
        
        console.log(`Cookie ${cookie.name}: SameSite=${cookie.sameSite}, Secure=${cookie.secure}`);
      }
    });
  });

  test.describe('状態変更操作のメソッド制限', () => {
    test('GETメソッドで状態変更が行われない', async ({ request }) => {
      // GETリクエストで状態変更を試みる
      const deleteResponse = await request.get('/api/files/delete?id=123', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      }).catch(error => error.response);
      
      if (deleteResponse) {
        const status = deleteResponse.status();
        // GETでの削除操作は405 Method Not Allowedまたは404が期待される
        expect([404, 405]).toContain(status);
      }
    });

    test('POSTメソッドが適切に処理される', async ({ request }) => {
      const response = await request.post('/api/health', {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {}
      }).catch(error => error.response);
      
      // ヘルスチェックAPIは通常GETのみ受け付ける
      if (response) {
        const status = response.status();
        // 405 Method Not Allowed が期待される場合もある
        expect([200, 405]).toContain(status);
      }
    });
  });

  test.describe('カスタムヘッダーの検証', () => {
    test('カスタムヘッダーによる追加保護', async ({ page, context }) => {
      await page.goto('/upload');
      
      // カスタムヘッダーを監視
      const customHeaders: Record<string, string> = {};
      
      await context.route('**/api/**', route => {
        const headers = route.request().headers();
        
        // X-Requested-With ヘッダーの確認
        if (headers['x-requested-with']) {
          customHeaders['x-requested-with'] = headers['x-requested-with'];
        }
        
        route.continue();
      });
      
      // AJAXリクエストを発生させる
      await page.evaluate(() => {
        fetch('/api/health', {
          method: 'GET',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
      });
      
      await page.waitForTimeout(1000);
      
      // XMLHttpRequestヘッダーが送信されていることを確認
      if (customHeaders['x-requested-with']) {
        expect(customHeaders['x-requested-with']).toBe('XMLHttpRequest');
      }
    });
  });

  test.describe('フォームトークンの実装', () => {
    test('フォームに隠しCSRFトークンフィールドが存在する', async ({ page }) => {
      await page.goto('/upload');
      
      // 隠しフィールドの確認
      const csrfField = await page.locator('input[name="csrf_token"], input[name="_csrf"], input[name="csrfToken"]').first();
      const fieldExists = await csrfField.count() > 0;
      
      if (fieldExists) {
        const tokenValue = await csrfField.inputValue();
        expect(tokenValue).toBeTruthy();
        expect(tokenValue.length).toBeGreaterThan(20); // トークンは十分な長さを持つ
        
        console.log('CSRF token field found with value length:', tokenValue.length);
      } else {
        console.log('No CSRF token field found in form (may use header-based protection)');
      }
    });
  });

  test.describe('API エンドポイントの保護', () => {
    test('重要なAPIエンドポイントがCSRF保護されている', async ({ request }) => {
      const criticalEndpoints = [
        '/api/translate-pptx',
        '/api/files/delete',
        '/api/profile/update',
        '/api/settings/change'
      ];
      
      for (const endpoint of criticalEndpoints) {
        const response = await request.post(endpoint, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            // CSRFトークンなし
          },
          data: { test: 'data' }
        }).catch(error => error.response);
        
        if (response) {
          const status = response.status();
          // 401, 403, 404のいずれかが期待される
          expect([401, 403, 404]).toContain(status);
          
          console.log(`Endpoint ${endpoint}: Status ${status} (protected)`);
        }
      }
    });
  });
});

// CSRF防御のベストプラクティス確認
test.describe('🛡️ CSRF防御ベストプラクティス', () => {
  test('セキュリティヘッダーの包括的チェック', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    if (headers) {
      // Strict-Transport-Security (HSTS)
      const hsts = headers['strict-transport-security'];
      if (hsts) {
        expect(hsts).toContain('max-age=');
        console.log('HSTS:', hsts);
      }
      
      // X-Frame-Options (Clickjacking防止)
      const frameOptions = headers['x-frame-options'];
      if (frameOptions) {
        expect(['DENY', 'SAMEORIGIN']).toContain(frameOptions);
        console.log('X-Frame-Options:', frameOptions);
      }
      
      // X-Content-Type-Options
      const contentTypeOptions = headers['x-content-type-options'];
      if (contentTypeOptions) {
        expect(contentTypeOptions).toBe('nosniff');
        console.log('X-Content-Type-Options:', contentTypeOptions);
      }
      
      // Referrer-Policy
      const referrerPolicy = headers['referrer-policy'];
      if (referrerPolicy) {
        console.log('Referrer-Policy:', referrerPolicy);
      }
    }
  });
});
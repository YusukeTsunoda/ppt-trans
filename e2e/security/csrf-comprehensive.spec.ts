/**
 * CSRF Protection Comprehensive E2E Tests
 * QAエキスパート観点での完全な検証
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { testEnv, testUsers, csrfConfig, appConfig, printTestEnvironment } from '../config/test-environment';
import { CSRFTokenFactory, RequestFactory, BoundaryValueFactory, UserFactory } from '../fixtures/test-data-factory';

// テスト開始前に環境情報を出力
test.beforeAll(async () => {
  printTestEnvironment();
});

test.describe('CSRF Protection - Core Functionality', () => {
  test.describe.configure({ mode: 'parallel' });

  let csrfToken: string;
  let page: Page;
  let context: APIRequestContext;

  test.beforeEach(async ({ page: testPage, request }) => {
    page = testPage;
    context = request;
    
    // CSRFトークンを取得
    const response = await context.get(`${appConfig.baseUrl}/api/auth/csrf`);
    expect(response.ok(), `Failed to fetch CSRF token: ${response.status()}`).toBeTruthy();
    const data = await response.json();
    csrfToken = data.csrfToken;
    expect(csrfToken).toBeDefined();
    expect(csrfToken).toMatch(/^[a-f0-9]{64}$/); // 正規表現での形式検証
  });

  test('【正常系】有効なCSRFトークンでのPOSTリクエスト', async () => {
    const testUser = UserFactory.create();
    
    const response = await context.post(`${appConfig.baseUrl}/api/auth/signup`, {
      headers: {
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json',
      },
      data: {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      },
    });

    // CSRFエラーではないことを確認（403以外）
    expect(response.status()).not.toBe(403);
    
    // レスポンスボディの検証
    if (response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }
  });

  test('【異常系】CSRFトークンなしのPOSTリクエスト', async () => {
    const response = await context.post(`${appConfig.baseUrl}/api/auth/login`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        email: testUsers.standard.email,
        password: testUsers.standard.password,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/CSRF/i);
  });

  test('【異常系】無効なCSRFトークンパターンの検証', async () => {
    const invalidPatterns = CSRFTokenFactory.createInvalidPatterns();
    
    for (const pattern of invalidPatterns) {
      const response = await context.post(`${appConfig.baseUrl}/api/auth/login`, {
        headers: {
          'X-CSRF-Token': pattern.token,
          'Content-Type': 'application/json',
        },
        data: {
          email: testUsers.standard.email,
          password: testUsers.standard.password,
        },
        failOnStatusCode: false,
      });

      expect(response.status(), `Pattern: ${pattern.description}`).toBe(403);
      
      // エラーメッセージの一貫性を確認
      const body = await response.json();
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain('undefined');
      expect(body.error).not.toContain('null');
    }
  });

  test('【境界値】CSRFトークンの境界値テスト', async () => {
    const boundaries = BoundaryValueFactory.stringBoundaries();
    
    for (const boundary of boundaries) {
      const response = await context.post(`${appConfig.baseUrl}/api/auth/login`, {
        headers: {
          'X-CSRF-Token': boundary.value,
          'Content-Type': 'application/json',
        },
        data: {
          email: testUsers.standard.email,
          password: testUsers.standard.password,
        },
        failOnStatusCode: false,
      });

      // 境界値はすべて拒否されるべき
      expect(
        response.status(),
        `Boundary: ${boundary.description} should be rejected`
      ).toBe(403);
    }
  });
});

test.describe('CSRF Protection - Session Management', () => {
  test('【セッション】同一セッション内でのトークン再利用', async ({ request }) => {
    // 1. トークンを取得
    const tokenResponse = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
    const { csrfToken } = await tokenResponse.json();
    
    // 2. 同じトークンで複数のリクエスト
    const requests = Array.from({ length: 5 }, async (_, i) => {
      const response = await request.post(`${appConfig.baseUrl}/api/files`, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        data: { action: 'list', index: i },
        failOnStatusCode: false,
      });
      return response.status();
    });
    
    const statuses = await Promise.all(requests);
    
    // すべてのリクエストでトークンが有効
    statuses.forEach((status, index) => {
      expect(status, `Request ${index + 1} should not be CSRF blocked`).not.toBe(403);
    });
  });

  test('【セッション】異なるブラウザタブでのトークン共有', async ({ context }) => {
    const [page1, page2] = await Promise.all([
      context.newPage(),
      context.newPage(),
    ]);
    
    // 両方のページでトークンを取得
    const [response1, response2] = await Promise.all([
      page1.request.get(`${appConfig.baseUrl}/api/auth/csrf`),
      page2.request.get(`${appConfig.baseUrl}/api/auth/csrf`),
    ]);
    
    const token1 = (await response1.json()).csrfToken;
    const token2 = (await response2.json()).csrfToken;
    
    // 同じセッションなので同じトークンであるべき
    expect(token1).toBe(token2);
    
    await Promise.all([page1.close(), page2.close()]);
  });

  test('【セッション】ログアウト後のトークン無効化', async ({ page, request }) => {
    // 1. ログイン前のトークン取得
    const preLoginResponse = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
    const preLoginToken = (await preLoginResponse.json()).csrfToken;
    
    // 2. ログイン
    await page.goto(`${appConfig.baseUrl}/login`);
    await page.fill('input[type="email"]', testUsers.standard.email);
    await page.fill('input[type="password"]', testUsers.standard.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // 3. ログイン後のトークン取得
    const postLoginResponse = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
    const postLoginToken = (await postLoginResponse.json()).csrfToken;
    
    // 4. トークンが変更されていることを確認
    expect(postLoginToken).not.toBe(preLoginToken);
    
    // 5. ログアウト
    await request.post(`${appConfig.baseUrl}/api/auth/logout`, {
      headers: { 'X-CSRF-Token': postLoginToken },
    });
    
    // 6. 古いトークンが無効化されていることを確認
    const testResponse = await request.post(`${appConfig.baseUrl}/api/files`, {
      headers: {
        'X-CSRF-Token': postLoginToken,
        'Content-Type': 'application/json',
      },
      data: { action: 'list' },
      failOnStatusCode: false,
    });
    
    expect(testResponse.status()).toBe(403);
  });
});

test.describe('CSRF Protection - Attack Vectors', () => {
  test('【攻撃】クロスオリジンリクエストの拒否', async ({ request }) => {
    const maliciousOrigins = [
      'http://evil-site.com',
      'https://attacker.example',
      'http://localhost:9999',
      'null', // ローカルファイルからのリクエスト
    ];
    
    for (const origin of maliciousOrigins) {
      const response = await request.post(`${appConfig.baseUrl}/api/auth/login`, {
        headers: {
          'Origin': origin,
          'Referer': `${origin}/attack.html`,
          'Content-Type': 'application/json',
        },
        data: {
          email: testUsers.standard.email,
          password: testUsers.standard.password,
        },
        failOnStatusCode: false,
      });
      
      expect(
        response.status(),
        `Origin ${origin} should be blocked`
      ).toBeGreaterThanOrEqual(400);
    }
  });

  test('【攻撃】リファラーチェックバイパス試行', async ({ request }) => {
    const bypassAttempts = [
      { referer: undefined, description: 'No referer' },
      { referer: '', description: 'Empty referer' },
      { referer: 'data:', description: 'Data URL' },
      { referer: 'about:blank', description: 'About blank' },
    ];
    
    for (const attempt of bypassAttempts) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (attempt.referer !== undefined) {
        headers['Referer'] = attempt.referer;
      }
      
      const response = await request.post(`${appConfig.baseUrl}/api/auth/login`, {
        headers,
        data: {
          email: testUsers.standard.email,
          password: testUsers.standard.password,
        },
        failOnStatusCode: false,
      });
      
      expect(
        response.status(),
        `${attempt.description} should be blocked`
      ).toBe(403);
    }
  });

  test('【攻撃】トークン予測攻撃の検証', async ({ request }) => {
    // 複数のトークンを取得して予測可能性をチェック
    const tokens: string[] = [];
    
    for (let i = 0; i < 10; i++) {
      const response = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
      const { csrfToken } = await response.json();
      tokens.push(csrfToken);
    }
    
    // トークンの一意性を確認
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(tokens.length);
    
    // エントロピーチェック（簡易版）
    tokens.forEach(token => {
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token).toMatch(/^[a-f0-9]+$/); // 16進数
      
      // 連続する文字のチェック
      const hasSequence = /(.)\1{5,}/.test(token);
      expect(hasSequence, 'Token should not have long sequences').toBe(false);
    });
  });
});

test.describe('CSRF Protection - Performance & Reliability', () => {
  test('【性能】並行リクエストでのトークン処理', async ({ request }) => {
    const tokenResponse = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
    const { csrfToken } = await tokenResponse.json();
    
    // 20個の並行リクエストを送信
    const concurrentRequests = Array.from({ length: 20 }, async (_, i) => {
      const startTime = Date.now();
      
      const response = await request.post(`${appConfig.baseUrl}/api/files`, {
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        data: { action: 'list', requestId: i },
        failOnStatusCode: false,
      });
      
      const endTime = Date.now();
      
      return {
        status: response.status(),
        duration: endTime - startTime,
        requestId: i,
      };
    });
    
    const results = await Promise.all(concurrentRequests);
    
    // すべてのリクエストが処理されることを確認
    results.forEach(result => {
      expect(result.status).not.toBe(403);
      expect(result.duration).toBeLessThan(5000); // 5秒以内
    });
    
    // 性能統計
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`Average CSRF validation time: ${avgDuration}ms`);
    expect(avgDuration).toBeLessThan(1000); // 平均1秒以内
  });

  test('【信頼性】トークン有効期限の検証', async ({ request }) => {
    const response = await request.get(`${appConfig.baseUrl}/api/auth/csrf`);
    const cookies = response.headers()['set-cookie'];
    
    // Cookie設定の検証
    expect(cookies).toBeDefined();
    
    if (cookies) {
      const cookieString = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      
      // Max-Age または Expires の確認
      const hasMaxAge = cookieString.includes('Max-Age=');
      const hasExpires = cookieString.includes('Expires=');
      
      expect(hasMaxAge || hasExpires, 'Token should have expiration').toBe(true);
      
      // Secureフラグの確認（本番環境）
      if (process.env.NODE_ENV === 'production') {
        expect(cookieString).toContain('Secure');
      }
      
      // HttpOnlyフラグの確認
      expect(cookieString).toContain('HttpOnly');
      
      // SameSiteフラグの確認
      expect(cookieString).toMatch(/SameSite=(Strict|Lax)/);
    }
  });
});

test.describe('CSRF Protection - Form Integration', () => {
  test('【統合】ログインフォームでのCSRF自動処理', async ({ page }) => {
    await page.goto(`${appConfig.baseUrl}/login`);
    
    // ネットワークリクエストを監視
    const requestPromise = page.waitForRequest(
      req => req.url().includes('/api/auth/login') && req.method() === 'POST',
      { timeout: appConfig.timeout }
    );
    
    // フォーム入力と送信
    await page.fill('input[type="email"]', testUsers.standard.email);
    await page.fill('input[type="password"]', testUsers.standard.password);
    await page.click('button[type="submit"]');
    
    const request = await requestPromise;
    const headers = request.headers();
    
    // CSRFトークンが含まれていることを確認
    expect(headers['x-csrf-token']).toBeDefined();
    expect(headers['x-csrf-token']).toMatch(/^[a-f0-9]{32,}$/);
  });

  test('【統合】ファイルアップロードでのCSRF処理', async ({ page }) => {
    // ログイン
    await page.goto(`${appConfig.baseUrl}/login`);
    await page.fill('input[type="email"]', testUsers.standard.email);
    await page.fill('input[type="password"]', testUsers.standard.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    
    // アップロードページへ
    await page.goto(`${appConfig.baseUrl}/upload`);
    
    // ファイル選択のモック
    const fileInput = await page.locator('input[type="file"]');
    
    // ネットワーク監視
    const uploadPromise = page.waitForRequest(
      req => req.url().includes('/api/upload') && req.method() === 'POST',
      { timeout: appConfig.timeout }
    );
    
    // テストファイルをアップロード
    await fileInput.setInputFiles({
      name: 'test.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      buffer: Buffer.from('test content'),
    });
    
    // アップロードボタンをクリック
    const uploadButton = await page.locator('button:has-text("アップロード")');
    if (await uploadButton.isVisible()) {
      await uploadButton.click();
      
      const uploadRequest = await uploadPromise;
      const headers = uploadRequest.headers();
      
      // multipart/form-dataでもCSRFトークンが含まれることを確認
      expect(headers['x-csrf-token']).toBeDefined();
    }
  });
});

test.describe('CSRF Protection - Error Handling', () => {
  test('【エラー】CSRFエラーメッセージの一貫性', async ({ request }) => {
    const scenarios = [
      { token: '', scenario: 'Empty token' },
      { token: 'invalid', scenario: 'Invalid token' },
      { token: undefined, scenario: 'No token' },
    ];
    
    const errorMessages = new Set<string>();
    
    for (const { token, scenario } of scenarios) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token !== undefined) {
        headers['X-CSRF-Token'] = token;
      }
      
      const response = await request.post(`${appConfig.baseUrl}/api/auth/login`, {
        headers,
        data: {
          email: testUsers.standard.email,
          password: testUsers.standard.password,
        },
        failOnStatusCode: false,
      });
      
      expect(response.status(), `${scenario} should return 403`).toBe(403);
      
      const body = await response.json();
      errorMessages.add(body.error);
      
      // エラーメッセージの品質チェック
      expect(body.error).toBeDefined();
      expect(body.error).not.toContain('undefined');
      expect(body.error).not.toContain('null');
      expect(body.error.length).toBeGreaterThan(0);
    }
    
    // すべてのシナリオで一貫したエラーメッセージ
    expect(errorMessages.size, 'Error messages should be consistent').toBe(1);
  });

  test('【エラー】CSRFエラー時のリトライ処理', async ({ page }) => {
    await page.goto(`${appConfig.baseUrl}/login`);
    
    // CSRFトークン取得をブロック（ネットワークエラーをシミュレート）
    await page.route('**/api/auth/csrf', route => {
      route.abort('failed');
    });
    
    // フォーム送信を試行
    await page.fill('input[type="email"]', testUsers.standard.email);
    await page.fill('input[type="password"]', testUsers.standard.password);
    
    // エラー表示を確認
    await page.click('button[type="submit"]');
    
    // エラーメッセージが表示されることを確認
    const errorMessage = await page.locator('[role="alert"], .error, .text-red-500').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    
    // ユーザーフレンドリーなメッセージであることを確認
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeDefined();
    expect(errorText).not.toContain('CSRF'); // 技術的な詳細を露出しない
    expect(errorText).not.toContain('403');
    expect(errorText).toMatch(/エラー|失敗|できません/);
  });
});

// テスト終了後のクリーンアップ
test.afterAll(async () => {
  console.log('✅ CSRF Protection E2E Tests Completed');
});
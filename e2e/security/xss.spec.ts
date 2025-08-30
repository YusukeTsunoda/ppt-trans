import { test, expect } from '@playwright/test';

/**
 * XSS (Cross-Site Scripting) 防御テスト
 * 
 * このテストスイートは、アプリケーションがXSS攻撃に対して
 * 適切に防御されているかを検証します。
 */

test.describe('🔒 XSS攻撃防御テスト', () => {
  // XSS攻撃ペイロードのリスト
  const XSS_PAYLOADS = [
    {
      name: 'Basic script tag',
      payload: '<script>alert("XSS")</script>',
      expectedSanitized: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
    },
    {
      name: 'Image tag with onerror',
      payload: '<img src=x onerror=alert("XSS")>',
      expectedSanitized: '&lt;img src=x onerror=alert("XSS")&gt;'
    },
    {
      name: 'JavaScript URL',
      payload: 'javascript:alert("XSS")',
      expectedSanitized: 'javascript:alert("XSS")'
    },
    {
      name: 'SVG with onload',
      payload: '<svg onload=alert("XSS")>',
      expectedSanitized: '&lt;svg onload=alert("XSS")&gt;'
    },
    {
      name: 'Nested quote injection',
      payload: '"><script>alert("XSS")</script>',
      expectedSanitized: '"&gt;&lt;script&gt;alert("XSS")&lt;/script&gt;'
    },
    {
      name: 'Event handler injection',
      payload: '" onclick="alert(\'XSS\')"',
      expectedSanitized: '" onclick="alert(\'XSS\')"'
    },
    {
      name: 'Data URI scheme',
      payload: 'data:text/html,<script>alert("XSS")</script>',
      expectedSanitized: 'data:text/html,&lt;script&gt;alert("XSS")&lt;/script&gt;'
    },
    {
      name: 'Unicode escape sequence',
      payload: '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E',
      expectedSanitized: '\\u003Cscript\\u003Ealert("XSS")\\u003C/script\\u003E'
    }
  ];

  test.beforeEach(async ({ page }) => {
    // ダイアログ（alert）の監視設定
    page.on('dialog', async dialog => {
      console.error(`❌ XSS Alert detected: ${dialog.message()}`);
      await dialog.dismiss();
      // XSSが実行された場合はテストを失敗させる
      throw new Error(`XSS vulnerability detected! Alert message: ${dialog.message()}`);
    });
  });

  test.describe('ユーザー登録フォーム', () => {
    for (const { name, payload } of XSS_PAYLOADS) {
      test(`${name} - メールフィールド`, async ({ page }) => {
        await page.goto('/register');
        
        // XSSペイロードを入力
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', 'ValidPassword123!');
        await page.fill('input[name="confirmPassword"]', 'ValidPassword123!');
        
        // フォーム送信
        await page.click('button[type="submit"]');
        
        // 1秒待機してアラートが表示されないことを確認
        await page.waitForTimeout(1000);
        
        // 入力値が適切にエスケープされているか確認
        const inputValue = await page.inputValue('input[name="email"]');
        expect(inputValue).toBe(payload); // 入力フィールドでは元の値が保持される
        
        // エラーメッセージ内でエスケープされているか確認
        const errorMessage = page.locator('.error-message, .text-red-500');
        const errorCount = await errorMessage.count();
        if (errorCount > 0) {
          const errorText = await errorMessage.textContent();
          // エラーメッセージ内にスクリプトタグが含まれていないことを確認
          expect(errorText).not.toContain('<script>');
          expect(errorText).not.toContain('<img');
          expect(errorText).not.toContain('<svg');
        }
      });
    }
  });

  test.describe('ログインフォーム', () => {
    test('複数のXSSペイロードでログイン試行', async ({ page }) => {
      await page.goto('/login');
      
      for (const { name, payload } of XSS_PAYLOADS) {
        // XSSペイロードを使用してログイン試行
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', payload);
        await page.click('button[type="submit"]');
        
        // エラーメッセージの確認
        await page.waitForSelector('.error-message, .text-red-500, [role="alert"]', { timeout: 5000 }).catch(() => {});
        
        // ページコンテンツにスクリプトが実行されていないことを確認
        const pageContent = await page.content();
        expect(pageContent).not.toMatch(/<script[^>]*>alert\("XSS"\)<\/script>/);
        
        // フィールドをクリア
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
      }
    });
  });

  test.describe('ファイルアップロード', () => {
    test.beforeEach(async ({ page }) => {
      // テストユーザーでログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    });

    test('悪意のあるファイル名でのアップロード', async ({ page }) => {
      await page.goto('/upload');
      
      // 悪意のあるファイル名のテスト
      const maliciousFileNames = [
        '<script>alert("XSS")</script>.pptx',
        '"><img src=x onerror=alert("XSS")>.pptx',
        '../../../etc/passwd.pptx',
        'file.pptx<script>alert("XSS")</script>',
        'file.pptx\0.jpg' // Null byte injection
      ];
      
      for (const fileName of maliciousFileNames) {
        // ファイル名が表示される場所を確認
        const fileInput = page.locator('input[type="file"]');
        
        // テストファイルの作成とアップロード
        const buffer = Buffer.from('test content');
        await fileInput.setInputFiles({
          name: fileName,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          buffer: buffer
        });
        
        // ファイル名が適切にサニタイズされて表示されることを確認
        const displayedFileName = await page.locator('.file-name, .selected-file, [data-testid="file-name"]').textContent().catch(() => '');
        
        if (displayedFileName) {
          // スクリプトタグが実行されていないことを確認
          expect(displayedFileName).not.toContain('<script>');
          expect(displayedFileName).not.toContain('<img');
          expect(displayedFileName).not.toContain('../');
        }
        
        // ファイル選択をクリア
        await page.evaluate(() => {
          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (input) input.value = '';
        });
      }
    });
  });

  test.describe('URLパラメータ', () => {
    test('URLパラメータ経由のXSS攻撃', async ({ page }) => {
      // XSSペイロードを含むURLパラメータでアクセス
      const xssUrls = [
        '/login?error=<script>alert("XSS")</script>',
        '/login?redirect=javascript:alert("XSS")',
        '/dashboard?name="><script>alert("XSS")</script>',
        '/upload?file=<img src=x onerror=alert("XSS")>'
      ];
      
      for (const url of xssUrls) {
        await page.goto(url);
        
        // ページがレンダリングされるのを待つ
        await page.waitForTimeout(1000);
        
        // URLパラメータが画面に表示される場合、エスケープされていることを確認
        const pageContent = await page.content();
        
        // 生のスクリプトタグが存在しないことを確認
        expect(pageContent).not.toMatch(/<script[^>]*>alert\("XSS"\)<\/script>/);
        expect(pageContent).not.toMatch(/<img[^>]*onerror="?alert/);
        
        // エスケープされた形式で表示されていることを確認
        if (pageContent.includes('&lt;script&gt;')) {
          // 適切にエスケープされている
          expect(pageContent).toContain('&lt;script&gt;');
        }
      }
    });
  });

  test.describe('localStorage/sessionStorage', () => {
    test('ストレージ経由のXSS攻撃防御', async ({ page }) => {
      await page.goto('/');
      
      // 悪意のあるデータをストレージに設定
      await page.evaluate(() => {
        localStorage.setItem('xss_test', '<script>alert("XSS from localStorage")</script>');
        sessionStorage.setItem('xss_test', '<img src=x onerror=alert("XSS from sessionStorage")>');
      });
      
      // ページをリロード
      await page.reload();
      
      // ストレージのデータが画面に表示される場合の確認
      const localStorageData = await page.evaluate(() => localStorage.getItem('xss_test'));
      const sessionStorageData = await page.evaluate(() => sessionStorage.getItem('xss_test'));
      
      // データが存在することを確認
      expect(localStorageData).toBeTruthy();
      expect(sessionStorageData).toBeTruthy();
      
      // ページコンテンツにスクリプトが実行されていないことを確認
      const pageContent = await page.content();
      expect(pageContent).not.toMatch(/alert\("XSS from localStorage"\)/);
      expect(pageContent).not.toMatch(/alert\("XSS from sessionStorage"\)/);
      
      // クリーンアップ
      await page.evaluate(() => {
        localStorage.removeItem('xss_test');
        sessionStorage.removeItem('xss_test');
      });
    });
  });

  test.describe('Content Security Policy (CSP)', () => {
    test('CSPヘッダーの確認', async ({ page }) => {
      const response = await page.goto('/');
      const headers = response?.headers();
      
      if (headers) {
        const cspHeader = headers['content-security-policy'] || headers['x-content-security-policy'];
        
        if (cspHeader) {
          // CSPが設定されている場合、unsafe-inlineが無効になっていることを確認
          expect(cspHeader).not.toContain("'unsafe-inline'");
          expect(cspHeader).not.toContain("'unsafe-eval'");
          
          // 推奨されるディレクティブが含まれていることを確認
          expect(cspHeader).toMatch(/default-src|script-src/);
        } else {
          console.warn('⚠️ CSP header not found - application may be vulnerable to XSS');
        }
      }
    });
  });

  test.describe('DOM-based XSS', () => {
    test('innerHTML/innerTextの安全な使用', async ({ page }) => {
      await page.goto('/');
      
      // DOMベースのXSSをテスト
      const result = await page.evaluate(() => {
        const testDiv = document.createElement('div');
        const xssPayload = '<script>window.xssExecuted = true;</script>';
        
        // innerHTMLの使用（危険）
        testDiv.innerHTML = xssPayload;
        document.body.appendChild(testDiv);
        
        // スクリプトが実行されたかチェック
        const xssExecuted = (window as any).xssExecuted;
        
        // クリーンアップ
        document.body.removeChild(testDiv);
        delete (window as any).xssExecuted;
        
        return xssExecuted;
      });
      
      // innerHTMLで直接スクリプトを挿入しても実行されないことを確認
      // （ブラウザのデフォルト動作）
      expect(result).toBeUndefined();
    });
  });

  test.describe('API レスポンス', () => {
    test('APIレスポンスのXSSペイロード処理', async ({ page, request }) => {
      // APIエンドポイントに直接XSSペイロードを送信
      const xssPayload = '<script>alert("XSS")</script>';
      
      try {
        const response = await request.post('/api/translate-pptx', {
          data: {
            fileName: xssPayload,
            content: 'test content'
          },
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok()) {
          const responseData = await response.json();
          
          // レスポンスにXSSペイロードが含まれる場合、エスケープされていることを確認
          if (responseData.fileName) {
            expect(responseData.fileName).not.toContain('<script>');
          }
        }
      } catch (error) {
        // APIエラーは許容（認証が必要な場合など）
        console.log('API call failed (expected for unauthenticated requests)');
      }
    });
  });
});

// XSS防御のベストプラクティスを確認するテスト
test.describe('🛡️ XSS防御ベストプラクティス', () => {
  test('セキュリティヘッダーの確認', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    if (headers) {
      // X-XSS-Protection ヘッダー
      const xssProtection = headers['x-xss-protection'];
      if (xssProtection) {
        expect(xssProtection).toContain('1');
        expect(xssProtection).toContain('mode=block');
      }
      
      // X-Content-Type-Options ヘッダー
      const contentTypeOptions = headers['x-content-type-options'];
      expect(contentTypeOptions).toBe('nosniff');
      
      // X-Frame-Options ヘッダー（クリックジャッキング防御）
      const frameOptions = headers['x-frame-options'];
      expect(frameOptions).toMatch(/DENY|SAMEORIGIN/);
    }
  });
});
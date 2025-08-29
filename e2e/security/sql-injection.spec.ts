import { test, expect } from '@playwright/test';

/**
 * SQLインジェクション防御テスト
 * 
 * このテストスイートは、アプリケーションがSQLインジェクション攻撃に対して
 * 適切に防御されているかを検証します。
 */

test.describe('🗄️ SQLインジェクション防御テスト', () => {
  // SQLインジェクションペイロードのリスト
  const SQL_INJECTION_PAYLOADS = [
    {
      name: 'Classic OR 1=1',
      payload: "' OR '1'='1",
      description: '常にTRUEになる条件を注入'
    },
    {
      name: 'Drop Table',
      payload: "'; DROP TABLE users; --",
      description: 'テーブル削除を試みる'
    },
    {
      name: 'Union Select',
      payload: "' UNION SELECT * FROM users WHERE '1'='1",
      description: '別テーブルからデータを取得'
    },
    {
      name: 'Comment Bypass',
      payload: "admin'--",
      description: 'コメントを使用してパスワードチェックを回避'
    },
    {
      name: 'Time-based Blind',
      payload: "' OR SLEEP(5)--",
      description: '時間ベースのブラインドSQLインジェクション'
    },
    {
      name: 'Boolean Blind',
      payload: "' AND '1'='1",
      description: 'ブーリアンベースのブラインドSQLインジェクション'
    },
    {
      name: 'Stacked Queries',
      payload: "'; INSERT INTO users VALUES('hacker', 'password'); --",
      description: '複数のクエリを実行'
    },
    {
      name: 'Hex Encoding',
      payload: "0x27204F52202731273D2731",
      description: '16進エンコーディングを使用'
    },
    {
      name: 'Double Quote',
      payload: '" OR ""="',
      description: 'ダブルクォートを使用'
    },
    {
      name: 'Null Byte',
      payload: "admin\0'--",
      description: 'Nullバイトインジェクション'
    }
  ];

  test.describe('ログインフォーム', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    for (const { name, payload, description } of SQL_INJECTION_PAYLOADS) {
      test(`${name}: ${description}`, async ({ page }) => {
        // SQLインジェクションペイロードを入力
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', payload);
        
        // ログイン試行
        await page.click('button[type="submit"]');
        
        // エラーメッセージの確認
        const errorMessage = await page.waitForSelector(
          '.error-message, .text-red-500, [role="alert"], text=/Invalid|無効|認証エラー/i',
          { timeout: 5000 }
        ).catch(() => null);
        
        if (errorMessage) {
          const errorText = await errorMessage.textContent();
          
          // SQLエラーが露出していないことを確認
          expect(errorText).not.toContain('syntax error');
          expect(errorText).not.toContain('SQL');
          expect(errorText).not.toContain('postgres');
          expect(errorText).not.toContain('mysql');
          expect(errorText).not.toContain('sqlite');
          expect(errorText).not.toContain('ORA-'); // Oracle エラー
          expect(errorText).not.toContain('table');
          expect(errorText).not.toContain('column');
          
          console.log(`✅ ${name}: Properly handled - Generic error shown`);
        }
        
        // ログインが成功していないことを確認
        await expect(page).toHaveURL(/.*login/);
        
        // ページ全体でSQLエラーが露出していないことを確認
        const pageContent = await page.content();
        expect(pageContent).not.toMatch(/syntax error at or near/i);
        expect(pageContent).not.toMatch(/You have an error in your SQL syntax/i);
      });
    }

    test('大量のシングルクォート注入', async ({ page }) => {
      const massivePayload = "'".repeat(1000);
      
      await page.fill('input[name="email"]', massivePayload);
      await page.fill('input[name="password"]', 'password');
      await page.click('button[type="submit"]');
      
      // アプリケーションがクラッシュしないことを確認
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/.*login/);
      
      // エラーが適切に処理されることを確認
      const errorVisible = await page.locator('.error-message, .text-red-500').isVisible();
      expect(errorVisible).toBeTruthy();
    });
  });

  test.describe('検索機能', () => {
    test.beforeEach(async ({ page }) => {
      // テストユーザーでログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    });

    test('検索フィールドでのSQLインジェクション', async ({ page }) => {
      // 検索フィールドが存在する場合のテスト
      const searchInput = page.locator('input[type="search"], input[placeholder*="検索"], input[placeholder*="Search"]').first();
      const searchExists = await searchInput.count() > 0;
      
      if (searchExists) {
        for (const { name, payload } of SQL_INJECTION_PAYLOADS.slice(0, 5)) {
          await searchInput.fill(payload);
          await searchInput.press('Enter');
          
          // エラーが表示されないことを確認
          await page.waitForTimeout(1000);
          
          const pageContent = await page.content();
          expect(pageContent).not.toContain('SQL');
          expect(pageContent).not.toContain('syntax error');
          
          console.log(`✅ Search field - ${name}: Properly sanitized`);
        }
      } else {
        console.log('⚠️ No search field found - skipping search tests');
      }
    });
  });

  test.describe('URLパラメータ', () => {
    test('URLパラメータ経由のSQLインジェクション', async ({ page }) => {
      const injectionUrls = [
        `/dashboard?id=' OR '1'='1`,
        `/dashboard?user=admin'--`,
        `/files?sort='; DROP TABLE files; --`,
        `/profile?id=1' UNION SELECT * FROM users--`,
        `/api/files?filter=' OR SLEEP(5)--`
      ];
      
      for (const url of injectionUrls) {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // ページが正常に読み込まれることを確認
        expect(response?.status()).toBeLessThan(500);
        
        // SQLエラーが表示されないことを確認
        const pageContent = await page.content();
        expect(pageContent).not.toContain('SQL');
        expect(pageContent).not.toContain('syntax error');
        expect(pageContent).not.toContain('database error');
        
        console.log(`✅ URL parameter injection blocked: ${url.split('?')[1]}`);
      }
    });
  });

  test.describe('プロファイル更新', () => {
    test.beforeEach(async ({ page }) => {
      // ログイン
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
    });

    test('プロファイル更新フォームでのSQLインジェクション', async ({ page }) => {
      // プロファイルページに移動
      await page.goto('/profile');
      
      // 名前フィールドが存在する場合
      const nameInput = page.locator('input[name="name"], input[name="displayName"], input[name="fullName"]').first();
      const nameExists = await nameInput.count() > 0;
      
      if (nameExists) {
        // SQLインジェクションペイロードを入力
        await nameInput.fill("Robert'; DROP TABLE users; --");
        
        // 保存ボタンをクリック
        const saveButton = page.locator('button:has-text("保存"), button:has-text("Save"), button:has-text("更新")').first();
        if (await saveButton.count() > 0) {
          await saveButton.click();
          
          // エラーチェック
          await page.waitForTimeout(2000);
          
          // データベースエラーが表示されないことを確認
          const pageContent = await page.content();
          expect(pageContent).not.toContain('DROP TABLE');
          expect(pageContent).not.toContain('SQL');
          
          console.log('✅ Profile update: SQL injection properly handled');
        }
      }
    });
  });

  test.describe('APIエンドポイント', () => {
    let authToken: string;
    
    test.beforeEach(async ({ page }) => {
      // ログインしてトークンを取得
      await page.goto('/login');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'Test123456!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
      
      // トークンの取得
      authToken = await page.evaluate(() => {
        return localStorage.getItem('supabase.auth.token') || '';
      });
    });

    test('API経由のSQLインジェクション試行', async ({ request }) => {
      const endpoints = [
        { url: '/api/files', method: 'GET', param: 'search' },
        { url: '/api/profile', method: 'POST', param: 'name' },
        { url: '/api/translate-pptx', method: 'POST', param: 'fileName' }
      ];
      
      for (const endpoint of endpoints) {
        const payload = "' OR '1'='1";
        
        let response;
        if (endpoint.method === 'GET') {
          response = await request.get(`${endpoint.url}?${endpoint.param}=${encodeURIComponent(payload)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          }).catch(error => error.response);
        } else {
          response = await request.post(endpoint.url, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            data: { [endpoint.param]: payload }
          }).catch(error => error.response);
        }
        
        if (response) {
          const responseText = await response.text().catch(() => '');
          
          // SQLエラーが返されないことを確認
          expect(responseText).not.toContain('SQL');
          expect(responseText).not.toContain('syntax error');
          expect(responseText).not.toContain('database');
          
          console.log(`✅ API ${endpoint.url}: SQL injection blocked`);
        }
      }
    });
  });

  test.describe('Prepared Statements検証', () => {
    test('パラメータ化クエリの使用確認', async ({ page }) => {
      // 特殊文字を含む正当な入力
      const legitimateInputs = [
        "O'Brien", // アポストロフィを含む名前
        "test@example.com'; --", // メールアドレス形式でない
        "50% discount", // パーセント記号
        "user_123", // アンダースコア
        "test\\user" // バックスラッシュ
      ];
      
      await page.goto('/login');
      
      for (const input of legitimateInputs) {
        await page.fill('input[name="email"]', input);
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');
        
        // エラーが適切に処理されることを確認
        await page.waitForTimeout(1000);
        
        const pageContent = await page.content();
        // 特殊文字が原因でSQLエラーが発生しないことを確認
        expect(pageContent).not.toContain('syntax error');
        
        // フィールドをクリア
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
      }
      
      console.log('✅ Special characters handled properly - Prepared statements likely in use');
    });
  });

  test.describe('エラーメッセージの検証', () => {
    test('詳細なエラー情報が露出しない', async ({ page }) => {
      await page.goto('/login');
      
      // 様々な不正な入力でテスト
      const testCases = [
        { email: "' OR '1'='1", password: "password" },
        { email: "test@example.com", password: "' OR '1'='1" },
        { email: "admin'--", password: "" },
        { email: "'; SELECT * FROM users; --", password: "password" }
      ];
      
      for (const testCase of testCases) {
        await page.fill('input[name="email"]', testCase.email);
        await page.fill('input[name="password"]', testCase.password);
        await page.click('button[type="submit"]');
        
        // エラーメッセージを取得
        const errorElement = await page.locator('.error-message, .text-red-500, [role="alert"]').first();
        if (await errorElement.count() > 0) {
          const errorText = await errorElement.textContent();
          
          // 一般的なエラーメッセージであることを確認
          expect(errorText).toMatch(/Invalid|無効|認証エラー|incorrect|wrong/i);
          
          // 技術的な詳細が含まれないことを確認
          expect(errorText).not.toContain('SELECT');
          expect(errorText).not.toContain('FROM');
          expect(errorText).not.toContain('WHERE');
          expect(errorText).not.toContain('users');
          expect(errorText).not.toContain('password');
          expect(errorText).not.toContain('database');
        }
        
        // フィールドをクリア
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
      }
      
      console.log('✅ Error messages properly sanitized - No sensitive information exposed');
    });
  });

  test.describe('NoSQL Injection対策', () => {
    test('NoSQLインジェクションペイロード', async ({ page }) => {
      // NoSQLインジェクションペイロード（MongoDBなど）
      const noSqlPayloads = [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
        '[$ne]=1',
        'true, $where: "1 == 1"',
        '"; return true; var foo="'
      ];
      
      await page.goto('/login');
      
      for (const payload of noSqlPayloads) {
        await page.fill('input[name="email"]', payload);
        await page.fill('input[name="password"]', payload);
        await page.click('button[type="submit"]');
        
        // ログインが失敗することを確認
        await expect(page).toHaveURL(/.*login/);
        
        // エラーが適切に処理されることを確認
        const errorVisible = await page.locator('.error-message, .text-red-500').isVisible();
        expect(errorVisible).toBeTruthy();
        
        // フィールドをクリア
        await page.fill('input[name="email"]', '');
        await page.fill('input[name="password"]', '');
      }
      
      console.log('✅ NoSQL injection payloads properly handled');
    });
  });
});

// SQLインジェクション防御のベストプラクティス
test.describe('🛡️ SQLインジェクション防御ベストプラクティス', () => {
  test('入力検証の確認', async ({ page }) => {
    await page.goto('/login');
    
    // 極端に長い入力
    const longInput = 'a'.repeat(10000);
    await page.fill('input[name="email"]', longInput);
    
    // 入力が適切に制限されることを確認
    const actualValue = await page.inputValue('input[name="email"]');
    expect(actualValue.length).toBeLessThanOrEqual(500); // 適切な長さ制限
    
    console.log('✅ Input length properly limited');
  });
  
  test('特殊文字のエスケープ確認', async ({ page }) => {
    await page.goto('/register');
    
    // 特殊文字を含むが正当な入力
    const specialChars = "Test & Co. <info@test.com>";
    
    const nameInput = page.locator('input[name="name"], input[name="displayName"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill(specialChars);
      
      // 値が保持されることを確認
      const value = await nameInput.inputValue();
      expect(value).toBe(specialChars);
      
      console.log('✅ Special characters properly handled in forms');
    }
  });
});
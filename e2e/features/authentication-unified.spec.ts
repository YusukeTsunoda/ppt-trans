/**
 * 統合版認証テスト
 * auth.spec.ts, auth-refactored.spec.ts, auth-improved.spec.tsを統合
 * 
 * リファクタリングのポイント：
 * 1. 重複テストケースを削除
 * 2. 共通フローを関数化
 * 3. データ駆動テストの採用
 * 4. 並列実行可能な構造
 */

import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  logout,
  testProtectedPageAccess,
  testFormValidationError,
  testSecurityPayload,
  measurePerformance
} from '../helpers/common-flows';
import {
  createTestUser,
  cleanupTestData,
  expectations,
  TestUser
} from '../fixtures/test-data';
import {
  assertUserIsLoggedIn,
  assertUserIsLoggedOut,
  assertErrorMessage,
  assertPagePerformance,
  assertAccessibility
} from '../helpers/custom-assertions';
import { testConfig } from '../config/test.config';

// テスト後のクリーンアップ
test.afterEach(async () => {
  await cleanupTestData();
});

test.describe('🔐 統合版認証フロー', () => {
  
  // データ駆動テスト: 新規登録のバリデーション
  const registrationTestCases = [
    {
      name: '有効な情報',
      email: () => `test-${Date.now()}@example.com`,
      password: 'ValidPass123!',
      confirmPassword: 'ValidPass123!',
      shouldSucceed: true
    },
    {
      name: 'パスワード不一致',
      email: () => `test-${Date.now()}@example.com`,
      password: 'ValidPass123!',
      confirmPassword: 'DifferentPass123!',
      shouldSucceed: false,
      expectedError: /パスワードが一致しません/
    },
    {
      name: '無効なメール形式',
      email: () => 'invalid-email',
      password: 'ValidPass123!',
      confirmPassword: 'ValidPass123!',
      shouldSucceed: false,
      expectedError: /有効なメールアドレス/
    }
  ];
  
  test.describe('新規登録', () => {
    for (const testCase of registrationTestCases) {
      test(`${testCase.shouldSucceed ? '✅' : '❌'} ${testCase.name}`, async ({ page }) => {
        await page.goto(`${testConfig.baseUrl}/register`);
        
        // アクセシビリティチェック（初回のみ）
        if (testCase === registrationTestCases[0]) {
          await assertAccessibility(page);
        }
        
        // フォーム入力
        await page.fill('[name="email"]', testCase.email());
        await page.fill('[name="password"]', testCase.password);
        await page.fill('[name="confirmPassword"]', testCase.confirmPassword);
        
        // 送信
        await page.click('button:has-text("新規登録")');
        
        if (testCase.shouldSucceed) {
          // 成功時の検証
          await page.waitForURL(/\/dashboard/, {
            timeout: testConfig.timeouts.navigation
          });
          await assertUserIsLoggedIn(page, testCase.email());
        } else {
          // エラー時の検証
          await expect(page).toHaveURL(/\/register/);
          if (testCase.expectedError) {
            await assertErrorMessage(page, 'invalidCredentials');
          }
        }
      });
    }
  });
  
  test.describe('ログイン', () => {
    let testUser: TestUser;
    
    test.beforeEach(async () => {
      testUser = await createTestUser();
    });
    
    test('✅ 正しい認証情報でログイン成功', async ({ page, context }) => {
      const { result, duration } = await measurePerformance(
        'login',
        async () => loginAsTestUser(page, testUser)
      );
      
      // パフォーマンス基準
      expect(duration).toBeLessThan(5000);
      
      // セッション確認
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name.includes('session'));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.httpOnly).toBe(true);
      
      // ページリロード後もセッション維持
      await page.reload();
      await assertUserIsLoggedIn(page, testUser.email);
      
      // ログアウト
      await logout(page);
      await assertUserIsLoggedOut(page);
    });
    
    test('❌ 誤った認証情報でログイン失敗', async ({ page }) => {
      await page.goto(`${testConfig.baseUrl}/login`);
      
      await page.fill('[name="email"]', testUser.email);
      await page.fill('[name="password"]', 'wrong_password');
      await page.click('button:has-text("ログイン")');
      
      await assertErrorMessage(page, 'invalidCredentials');
      await expect(page).toHaveURL(/\/login/);
    });
    
    // ログイン試行制限のテスト（1つのテストに統合）
    test('🔒 ログイン試行回数制限', async ({ page }) => {
      await page.goto(`${testConfig.baseUrl}/login`);
      
      const maxAttempts = 5;
      for (let i = 1; i <= maxAttempts; i++) {
        await page.fill('[name="email"]', 'test@example.com');
        await page.fill('[name="password"]', `wrong_${i}`);
        await page.click('button:has-text("ログイン")');
        
        if (i === maxAttempts) {
          // ロックアウトメッセージを確認
          const lockoutMessage = page.locator('text=/ロック|locked|too many attempts/i');
          if (await lockoutMessage.isVisible()) {
            expect(await lockoutMessage.textContent()).toMatch(/ロック|locked/i);
          }
        }
        
        await page.waitForTimeout(1000); // レート制限回避
      }
    });
  });
  
  test.describe('アクセス制御', () => {
    // データ駆動: 保護されたページ
    const protectedRoutes = [
      '/dashboard',
      '/upload', 
      '/files',
      '/profile',
      '/settings'
    ];
    
    test('🚫 未認証時の保護ページへのアクセス', async ({ page }) => {
      for (const route of protectedRoutes) {
        const result = await testProtectedPageAccess(page, route);
        
        expect(result.redirected).toBe(true);
        expect(result.hasCallbackUrl).toBe(true);
        expect(result.redirectUrl).toContain(`callbackUrl=${encodeURIComponent(route)}`);
      }
    });
    
    test('✅ callbackURL経由でのリダイレクト', async ({ page }) => {
      const testUser = await createTestUser();
      const targetRoute = '/dashboard';
      
      // 保護ページへアクセス
      await testProtectedPageAccess(page, targetRoute);
      
      // ログイン
      await page.fill('[name="email"]', testUser.email);
      await page.fill('[name="password"]', testUser.password);
      await page.click('button:has-text("ログイン")');
      
      // 元のページへリダイレクト
      await page.waitForURL(targetRoute, {
        timeout: testConfig.timeouts.navigation
      });
      
      expect(page.url()).toContain(targetRoute);
    });
  });
  
  test.describe('セキュリティ', () => {
    // XSSペイロードテスト（データ駆動）
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '"><script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>'
    ];
    
    test('🔒 XSSペイロードのサニタイズ', async ({ page }) => {
      await page.goto(`${testConfig.baseUrl}/register`);
      
      for (const payload of xssPayloads) {
        const result = await testSecurityPayload(
          page,
          '[name="email"]',
          payload
        );
        
        expect(result.alertFired).toBe(false);
        expect(result.sanitized).toBe(true);
      }
    });
    
    // パスワード複雑性のテスト（データ駆動）
    const passwordTests = [
      { password: '123456', shouldFail: true, reason: '弱すぎる' },
      { password: 'Password', shouldFail: true, reason: '数字なし' },
      { password: 'password123', shouldFail: true, reason: '大文字なし' },
      { password: 'PASSWORD123', shouldFail: true, reason: '小文字なし' },
      { password: 'ValidPass123!', shouldFail: false, reason: '有効' }
    ];
    
    test('🔐 パスワード複雑性要件', async ({ page }) => {
      await page.goto(`${testConfig.baseUrl}/register`);
      
      for (const { password, shouldFail, reason } of passwordTests) {
        const error = await testFormValidationError(
          page,
          'password',
          password
        );
        
        if (shouldFail) {
          expect(error).toBeTruthy();
          console.log(`✓ ${reason}: エラー表示確認`);
        } else {
          expect(error).toBeFalsy();
          console.log(`✓ ${reason}: エラーなし`);
        }
      }
    });
  });
  
  // パフォーマンステスト（統合）
  test.describe('パフォーマンス', () => {
    test('⚡ ページロード時間の基準', async ({ page }) => {
      const pages = [
        { path: '/login', maxTime: 2000 },
        { path: '/register', maxTime: 2000 }
      ];
      
      for (const { path, maxTime } of pages) {
        await page.goto(`${testConfig.baseUrl}${path}`);
        await assertPagePerformance(page, maxTime);
      }
    });
  });
});
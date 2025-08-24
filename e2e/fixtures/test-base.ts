import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { generateTestUser, createUserViaUI, type TestUser } from './test-user-management';

// Supabaseテストクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
);

// デフォルトテストユーザー情報（後方互換性のため残す）
export const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'testpassword123',  // Supabaseに登録されている実際のパスワード
  newEmail: 'test.new@example.com',
  newPassword: 'NewPassword123!'
};

// カスタムフィクスチャ
type TestFixtures = {
  authenticatedPage: any;
  testUser: TestUser;
  independentAuthPage: any;
};

export const test = base.extend<TestFixtures>({
  // 既存のフィクスチャ（後方互換性のため）
  authenticatedPage: async ({ page, baseURL }: { page: any; baseURL: string }, use: any) => {
    // テストユーザーでログイン
    await page.goto(`${baseURL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // ダッシュボードへのリダイレクトを待つ
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    await use(page);
    
    // クリーンアップ: ログアウト
    const logoutButton = page.locator('button:has-text("ログアウト")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    }
  },
  
  // 新規: 独立したテストユーザーを提供
  testUser: async ({}, use) => {
    const user = generateTestUser();
    await use(user);
    // テスト後のクリーンアップは現時点では省略（API未実装のため）
  },
  
  // 新規: 独立した認証済みページを提供
  independentAuthPage: async ({ page, baseURL, testUser }, use) => {
    // 新規ユーザーを作成してログイン
    try {
      // まず登録を試みる
      await createUserViaUI(page, baseURL);
    } catch (error) {
      // 既に登録済みの場合はログインを試みる
      await page.goto(`${baseURL}/login`);
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
    
    await use(page);
    
    // クリーンアップ: ログアウト
    try {
      const logoutButton = page.locator('button:has-text("ログアウト")');
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      }
    } catch (error) {
      console.warn('Logout cleanup failed:', error);
    }
  },
});

export { expect };

// ヘルパー関数
export async function setupTestUser() {
  try {
    // 既存のテストユーザーを削除
    await cleanupTestUser();
    
    // 新しいテストユーザーを作成
    const { error } = await supabase.auth.signUp({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    
    if (error && !error.message.includes('already registered')) {
      console.error('Failed to create test user:', error);
    }
  } catch (error) {
    console.error('Setup test user error:', error);
  }
}

export async function cleanupTestUser() {
  try {
    // Supabase Admin APIでユーザーを削除（サービスロールキーが必要）
    // ローカル開発環境では手動で削除する必要がある場合があります
    console.log('Test user cleanup - manual deletion may be required');
  } catch (error) {
    console.error('Cleanup test user error:', error);
  }
}

// ファイルアップロード用のテストファイルを作成
export async function createTestPPTXFile() {
  // 簡単なPPTXファイルのバイナリデータ（最小限のPPTX構造）
  const pptxContent = Buffer.from([
    0x50, 0x4b, 0x03, 0x04, // PKZip signature
    // 最小限のPPTX構造（実際のテストではより完全なファイルを使用）
  ]);
  
  return new File([pptxContent], 'test-presentation.pptx', {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  });
}

export async function createInvalidFile() {
  const textContent = 'This is not a PPTX file';
  return new File([textContent], 'invalid.txt', {
    type: 'text/plain'
  });
}

// Server Action待機用ヘルパー関数
export async function waitForServerAction(page: any, buttonSelector: string = 'button[type="submit"]') {
  const button = page.locator(buttonSelector).first();
  
  // ボタンが押せる状態を待つ
  await button.waitFor({ state: 'visible' });
  
  // 現在のボタンテキストを取得
  const originalText = await button.textContent();
  
  // クリック
  await button.click();
  
  // pending状態を待つ（ボタンテキストが変わる）
  try {
    await expect(button).not.toContainText(originalText || '', { timeout: 1000 });
  } catch {
    // pending状態にならない場合もある（速すぎる場合）
  }
  
  // 元の状態に戻るまで待つ、またはページ遷移を待つ
  await Promise.race([
    expect(button).toContainText(originalText || '', { timeout: 10000 }),
    page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {}),
  ]);
  
  // 少し待機（状態の安定化）
  await page.waitForTimeout(100);
}
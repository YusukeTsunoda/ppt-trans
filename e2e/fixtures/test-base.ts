import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Supabaseテストクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
);

// テストユーザー情報
export const TEST_USER = {
  email: 'e2e.test@example.com',
  password: 'Test123456!',
  newEmail: 'e2e.new@example.com',
  newPassword: 'NewTest123456!'
};

// カスタムフィクスチャ
type TestFixtures = {
  authenticatedPage: any;
};

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // テストユーザーでログイン
    await page.goto('/login');
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
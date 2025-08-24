/**
 * テスト用ユーザー管理システム
 * 各テストで独立したユーザーを作成・削除する
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: Date;
}

// ユニークなテストユーザーを生成
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const uniqueId = `${timestamp}-${randomId}`;
  
  return {
    id: uniqueId,
    email: `test-${uniqueId}@example.com`,
    password: `TestPass123!${randomId}`,
    name: `Test User ${uniqueId}`,
    createdAt: new Date(),
  };
}

// テストユーザーをSupabaseに作成（実際の作成はアプリケーション側のAPIを使用）
export async function createTestUser(baseURL: string): Promise<TestUser> {
  const user = generateTestUser();
  
  // テスト用のAPIエンドポイントがある場合はそれを使用
  // 現時点では通常の登録フローを使用
  try {
    const response = await fetch(`${baseURL}/api/test/create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // テスト環境の認証トークンが必要な場合
        'X-Test-Token': process.env.TEST_API_TOKEN || '',
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        name: user.name,
      }),
    });
    
    if (!response.ok) {
      // APIエンドポイントが存在しない場合は、生成したユーザー情報をそのまま返す
      console.warn('Test user API not available, using generated user data');
      return user;
    }
    
    const data = await response.json();
    return {
      ...user,
      id: data.userId || user.id,
    };
  } catch (error) {
    // エラー時は生成したユーザー情報を返す
    console.warn('Failed to create test user via API:', error);
    return user;
  }
}

// テストユーザーを削除
export async function deleteTestUser(baseURL: string, userId: string): Promise<void> {
  try {
    const response = await fetch(`${baseURL}/api/test/delete-user/${userId}`, {
      method: 'DELETE',
      headers: {
        'X-Test-Token': process.env.TEST_API_TOKEN || '',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to delete test user ${userId}`);
    }
  } catch (error) {
    console.warn('Failed to delete test user:', error);
  }
}

// すべてのテストユーザーをクリーンアップ
export async function cleanupAllTestUsers(baseURL: string): Promise<void> {
  try {
    const response = await fetch(`${baseURL}/api/test/cleanup-users`, {
      method: 'POST',
      headers: {
        'X-Test-Token': process.env.TEST_API_TOKEN || '',
      },
    });
    
    if (!response.ok) {
      console.warn('Failed to cleanup test users');
    }
  } catch (error) {
    console.warn('Failed to cleanup test users:', error);
  }
}

// ブラウザコンテキストでのユーザー作成（Playwrightページオブジェクトを使用）
export async function createUserViaUI(page: any, baseURL: string): Promise<TestUser> {
  const user = generateTestUser();
  
  // 登録ページに移動
  await page.goto(`${baseURL}/register`);
  
  // 登録フォームに入力
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  
  // 登録ボタンをクリック
  await page.click('button[type="submit"]');
  
  // 登録成功を待つ（ダッシュボードへのリダイレクトまたは成功メッセージ）
  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch {
    // ダッシュボードへのリダイレクトがない場合は成功メッセージを確認
    await page.waitForSelector('text=/登録.*成功|Registration.*successful/i', { timeout: 5000 });
  }
  
  return user;
}
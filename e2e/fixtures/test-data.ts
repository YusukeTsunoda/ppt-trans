/**
 * テストデータ管理
 * 動的にテストデータを生成し、テスト後にクリーンアップ
 */

import { createClient } from '@supabase/supabase-js';
import { testConfig } from '../config/test.config';
import { randomBytes } from 'crypto';

// Supabaseクライアント（Service Role Key使用）
const supabase = createClient(
  testConfig.supabase.url,
  testConfig.supabase.serviceKey || testConfig.supabase.anonKey
);

/**
 * テストユーザーの型定義
 */
export interface TestUser {
  email: string;
  password: string;
  id?: string;
  role?: 'user' | 'admin';
  createdAt?: Date;
}

/**
 * テストファイルの型定義
 */
export interface TestFile {
  name: string;
  path: string;
  size: number;
  type: 'valid' | 'invalid' | 'large' | 'corrupt';
}

/**
 * ユニークなテストユーザーを作成
 */
export async function createTestUser(options: Partial<TestUser> = {}): Promise<TestUser> {
  const timestamp = Date.now();
  const randomId = randomBytes(4).toString('hex');
  
  const testUser: TestUser = {
    email: options.email || `test-${timestamp}-${randomId}@example.com`,
    password: options.password || `Test${timestamp}!`,
    role: options.role || 'user'
  };
  
  try {
    // Supabaseでユーザーを作成
    const { data, error } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true, // メール確認をスキップ
      user_metadata: {
        role: testUser.role,
        test_user: true,
        created_for_test: timestamp
      }
    });
    
    if (error) {
      console.error('Failed to create test user:', error);
      // フォールバック: モックユーザーを返す
      return testUser;
    }
    
    testUser.id = data.user?.id;
    testUser.createdAt = new Date();
    
    // 作成したユーザーをトラッキング（クリーンアップ用）
    trackTestData('user', testUser.id!);
    
  } catch (err) {
    console.warn('Supabase connection failed, using mock user:', err);
  }
  
  return testUser;
}

/**
 * 既存のテストユーザーを取得または作成
 */
export async function getOrCreateTestUser(email: string, password: string): Promise<TestUser> {
  try {
    // まず既存ユーザーでログイン試行
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (data?.user) {
      return { email, password, id: data.user.id };
    }
    
    // ユーザーが存在しない場合は作成
    return await createTestUser({ email, password });
  } catch (err) {
    // エラー時はモックユーザーを返す
    return { email, password };
  }
}

/**
 * テストファイルのパスを取得
 */
export function getTestFile(type: TestFile['type']): TestFile {
  const testFilesDir = 'e2e/test-files';
  
  const files: Record<TestFile['type'], TestFile> = {
    valid: {
      name: 'valid-presentation.pptx',
      path: `${testFilesDir}/valid-presentation.pptx`,
      size: 1024 * 50, // 50KB
      type: 'valid'
    },
    invalid: {
      name: 'invalid-file.txt',
      path: `${testFilesDir}/invalid-file.txt`,
      size: 100,
      type: 'invalid'
    },
    large: {
      name: 'large-presentation.pptx',
      path: `${testFilesDir}/large-presentation.pptx`,
      size: 11 * 1024 * 1024, // 11MB
      type: 'large'
    },
    corrupt: {
      name: 'corrupt-presentation.pptx',
      path: `${testFilesDir}/corrupt-presentation.pptx`,
      size: 1024,
      type: 'corrupt'
    }
  };
  
  return files[type];
}

// テストデータのトラッキング（クリーンアップ用）
const testDataRegistry = new Map<string, Set<string>>();

/**
 * テストデータをトラッキング
 */
function trackTestData(type: string, id: string): void {
  if (!testDataRegistry.has(type)) {
    testDataRegistry.set(type, new Set());
  }
  testDataRegistry.get(type)!.add(id);
}

/**
 * テストデータをクリーンアップ
 */
export async function cleanupTestData(): Promise<void> {
  console.log('🧹 Cleaning up test data...');
  
  // ユーザーのクリーンアップ
  const userIds = testDataRegistry.get('user');
  if (userIds) {
    for (const userId of userIds) {
      try {
        await supabase.auth.admin.deleteUser(userId);
        console.log(`  ✓ Deleted test user: ${userId}`);
      } catch (err) {
        console.warn(`  ⚠️ Failed to delete user ${userId}:`, err);
      }
    }
  }
  
  // ファイルのクリーンアップ
  const fileIds = testDataRegistry.get('file');
  if (fileIds) {
    for (const fileId of fileIds) {
      try {
        await supabase.storage
          .from('pptx-files')
          .remove([fileId]);
        console.log(`  ✓ Deleted test file: ${fileId}`);
      } catch (err) {
        console.warn(`  ⚠️ Failed to delete file ${fileId}:`, err);
      }
    }
  }
  
  // レジストリをクリア
  testDataRegistry.clear();
}

/**
 * テスト用の期待値を生成
 */
export const expectations = {
  // 成功メッセージのパターン
  successMessages: {
    upload: /アップロードに成功しました|ファイルがアップロードされました|Upload successful/i,
    login: /ようこそ|Welcome|ログインしました/i,
    logout: /ログアウトしました|Logged out|またお越しください/i,
    translation: /翻訳が完了|Translation complete|翻訳済み/i
  },
  
  // エラーメッセージのパターン
  errorMessages: {
    invalidCredentials: /メールアドレスまたはパスワードが正しくありません|Invalid login credentials|認証に失敗/i,
    invalidFile: /無効なファイル形式|PPTXファイルのみ|Invalid file format|サポートされていない/i,
    fileTooLarge: /ファイルサイズが大きすぎます|10MB以下|File too large|サイズ制限/i,
    networkError: /ネットワークエラー|接続に失敗|Network error|通信エラー/i
  },
  
  // UI要素のセレクタ
  selectors: {
    // データ属性を使用（変更に強い）
    fileInput: '[data-testid="file-input"], input[type="file"]',
    uploadButton: '[data-testid="upload-button"], button:has-text("アップロード")',
    loginButton: '[data-testid="login-button"], button:has-text("ログイン")',
    logoutButton: '[data-testid="logout-button"], button:has-text("ログアウト")',
    userMenu: '[data-testid="user-menu"], [aria-label="User menu"]',
    progressBar: '[data-testid="progress-bar"], [role="progressbar"]',
    errorMessage: '[data-testid="error-message"], [role="alert"]',
    successMessage: '[data-testid="success-message"], .success-message'
  }
};
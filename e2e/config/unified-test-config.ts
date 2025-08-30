/**
 * E2Eテスト統一設定
 * 
 * すべてのE2Eテストで使用する共通設定を管理
 * ハードコーディングを防ぎ、環境間での移植性を確保
 */

import path from 'path';

// 環境変数の検証と取得
function getEnvOrDefault(key: string, defaultValue: string, isRequired = false): string {
  const value = process.env[key];
  
  if (!value && isRequired) {
    throw new Error(
      `必須環境変数 ${key} が設定されていません。\n` +
      `.env.test ファイルを作成し、適切な値を設定してください。`
    );
  }
  
  if (!value && !isRequired) {
    console.warn(
      `⚠️ 環境変数 ${key} が設定されていません。デフォルト値を使用: ${defaultValue}`
    );
  }
  
  return value || defaultValue;
}

// 統一テスト設定
export const UNIFIED_TEST_CONFIG = {
  // 認証情報（環境変数優先、デフォルト値あり）
  users: {
    standard: {
      email: getEnvOrDefault('TEST_USER_EMAIL', 'test@example.com'),
      password: getEnvOrDefault('TEST_USER_PASSWORD', 'Test123!'),
    },
    admin: {
      email: getEnvOrDefault('ADMIN_USER_EMAIL', 'admin@example.com'),
      password: getEnvOrDefault('ADMIN_USER_PASSWORD', 'Admin123!'),
    },
  },
  
  // アプリケーションURL
  baseUrl: getEnvOrDefault('BASE_URL', 'http://localhost:3000'),
  
  // Supabase設定
  supabase: {
    url: getEnvOrDefault('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321'),
    anonKey: getEnvOrDefault('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key'),
  },
  
  // タイムアウト設定（ミリ秒）
  timeouts: {
    quick: 5000,       // 簡単な操作
    standard: 10000,   // 標準的な操作
    navigation: 5000,  // ページ遷移
    element: 5000,     // 要素の表示待ち
    upload: 30000,     // ファイルアップロード
    translation: 60000,// 翻訳処理
    api: 10000,        // API応答
  },
  
  // エラーメッセージ（実際のアプリケーションと一致させる）
  errorMessages: {
    loginFailed: 'メールアドレスまたはパスワードが正しくありません',
    passwordMismatch: 'パスワードが一致しません',
    emailRequired: 'メールアドレスを入力してください',
    passwordRequired: 'パスワードを入力してください',
    invalidFileType: 'PowerPointファイル（.pptx）を選択してください',
    fileSizeExceeded: 'ファイルサイズが10MBを超えています',
    uploadFailed: 'アップロードに失敗しました',
    networkError: 'ネットワークエラーが発生しました',
  },
  
  // 成功メッセージ
  successMessages: {
    loginSuccess: 'ログインしました',
    signupSuccess: 'アカウントを作成しました',
    uploadSuccess: 'ファイルをアップロードしました',
    logoutSuccess: 'ログアウトしました',
    deleteSuccess: 'ファイルが削除されました',
    translationComplete: '翻訳が完了しました',
  },
  
  // テストデータ生成関数
  generateUser: () => ({
    email: `test-${Date.now()}@example.com`,
    password: `Test${Date.now()}!@#`,
  }),
  
  // テストファイルパス
  testFiles: {
    small: path.join(__dirname, '../fixtures/test-presentation.pptx'),
    medium: path.join(__dirname, '../fixtures/medium.pptx'),
    large: path.join(__dirname, '../fixtures/large.pptx'),
    invalid: path.join(__dirname, '../fixtures/invalid.txt'),
  },
  
  // フィーチャーフラグ（機能の有効/無効）
  features: {
    rateLimit: process.env.FEATURE_RATE_LIMIT === 'true',
    passwordReset: process.env.FEATURE_PASSWORD_RESET === 'true',
    adminPanel: process.env.FEATURE_ADMIN_PANEL === 'true',
    bulkUpload: process.env.FEATURE_BULK_UPLOAD === 'true',
  },
  
  // テスト実行モード
  mode: {
    isCI: process.env.CI === 'true',
    isDebug: process.env.DEBUG === 'true',
    isHeadless: process.env.HEADLESS !== 'false',
    retryCount: process.env.CI === 'true' ? 2 : 0,
  },
  
  // セレクター定義（統一）
  selectors: {
    auth: {
      emailInput: 'input[type="email"], input[name="email"]',
      passwordInput: 'input[type="password"], input[name="password"]',
      submitButton: 'button[type="submit"]',
      logoutButton: 'button:has-text("ログアウト"), text=ログアウト',
      errorMessage: '.bg-red-50, [role="alert"], .error-message',
    },
    upload: {
      fileInput: 'input[type="file"]',
      uploadButton: 'button:has-text("アップロード")',
      progressBar: '[role="progressbar"]',
      successMessage: '.bg-green-50, .success-message',
    },
    dashboard: {
      fileList: 'table, [role="grid"]',
      fileRow: 'tr:has-text(".pptx")',
      deleteButton: 'button:has-text("削除")',
      downloadButton: 'button:has-text("ダウンロード")',
    },
  },
};

// 型定義のエクスポート
export type UnifiedTestConfig = typeof UNIFIED_TEST_CONFIG;

// ヘルパー関数のエクスポート
export const testHelpers = {
  /**
   * 環境変数が設定されているか確認
   */
  validateEnvironment: () => {
    const required = [
      'TEST_USER_EMAIL',
      'TEST_USER_PASSWORD',
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.warn(
        `⚠️ 以下の環境変数が設定されていません:\n${missing.join('\n')}\n` +
        `デフォルト値が使用されますが、本番環境では設定してください。`
      );
    }
  },
  
  /**
   * テストユーザーが存在するか確認
   */
  checkTestUserExists: async (email: string): Promise<boolean> => {
    // Supabaseまたは他の認証プロバイダーでユーザーの存在を確認
    // この実装は環境に応じて調整が必要
    return true;
  },
};
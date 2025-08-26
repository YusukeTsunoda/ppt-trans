/**
 * E2Eテスト共通設定
 * 環境変数とデフォルト値の管理
 */

export interface TestUser {
  email: string;
  password: string;
  role: 'user' | 'admin';
  name: string;
}

export interface TestEnvironment {
  name: string;
  baseUrl: string;
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export class TestConfig {
  // 環境設定
  static readonly environment = process.env.TEST_ENV || 'local';
  static readonly baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  static readonly apiUrl = process.env.API_URL || 'http://localhost:3000/api';
  
  // タイムアウト設定（ミリ秒）
  static readonly timeouts = {
    navigation: 30000,
    action: 10000,
    element: 5000,
    api: 15000,
    upload: 60000,
    translation: 120000,
  };
  
  // テストユーザー
  static readonly users: Record<string, TestUser> = {
    default: {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword123',
      role: 'user',
      name: 'Test User'
    },
    admin: {
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin',
      name: 'Admin User'
    },
    user1: {
      email: 'user1@example.com',
      password: 'User123!',
      role: 'user',
      name: 'User One'
    }
  };
  
  // セレクター定義
  static readonly selectors = {
    auth: {
      emailInput: '[data-testid="email-input"], input[type="email"], input[name="email"]',
      passwordInput: '[data-testid="password-input"], input[type="password"], input[name="password"]',
      submitButton: '[data-testid="login-button"], button[type="submit"]:has-text("ログイン")',
      logoutButton: '[data-testid="logout-button"], button:has-text("ログアウト")',
      errorMessage: '[data-testid="error-message"], .bg-red-50, [role="alert"]',
      successMessage: '[data-testid="success-message"], .bg-green-50'
    },
    upload: {
      fileInput: 'input[type="file"]',
      uploadButton: '[data-testid="upload-button"], button:has-text("アップロード")',
      progressBar: '[data-testid="upload-progress"], [role="progressbar"]',
      fileList: '[data-testid="file-list"]',
      deleteButton: '[data-testid="delete-file"]'
    },
    translation: {
      targetLanguage: 'select[name="targetLanguage"]',
      translateButton: '[data-testid="translate-button"], button:has-text("翻訳")',
      downloadButton: '[data-testid="download-button"], button:has-text("ダウンロード")',
      cancelButton: '[data-testid="cancel-button"], button:has-text("キャンセル")',
      progressIndicator: '[data-testid="translation-progress"]'
    },
    navigation: {
      dashboard: 'a[href="/dashboard"], [data-testid="nav-dashboard"]',
      upload: 'a[href="/upload"], [data-testid="nav-upload"]',
      files: 'a[href="/files"], [data-testid="nav-files"]',
      profile: 'a[href="/profile"], [data-testid="nav-profile"]',
      admin: 'a[href="/admin"], [data-testid="nav-admin"]'
    }
  };
  
  // テストデータパス
  static readonly testData = {
    validPptx: 'e2e/fixtures/test-data/files/test-presentation.pptx',
    largePptx: 'e2e/fixtures/test-data/files/large-presentation.pptx',
    corruptedPptx: 'e2e/fixtures/test-data/files/corrupted.pptx',
    invalidFile: 'e2e/fixtures/test-data/files/invalid-file.txt'
  };
  
  // API エンドポイント
  static readonly endpoints = {
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      register: '/api/auth/register',
      resetPassword: '/api/auth/reset-password'
    },
    files: {
      upload: '/api/files/upload',
      list: '/api/files',
      delete: '/api/files/:id',
      download: '/api/files/:id/download'
    },
    translation: {
      start: '/api/translate',
      status: '/api/translate/:id/status',
      cancel: '/api/translate/:id/cancel'
    }
  };
}
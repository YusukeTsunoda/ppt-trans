import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Playwright E2E Test Configuration
 * 関心の分離に基づいた設定
 */

// .env.testファイルを読み込む
dotenv.config({ path: '.env.test' });

// ポート番号を環境変数から取得（デフォルト: 3000）
const PORT = process.env.TEST_PORT || '3001';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// 認証状態ファイルのパス（固定名を使用）
const authFile = path.join(__dirname, 'playwright-auth.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  maxFailures: process.env.CI ? 0 : 1, // 最初の失敗で停止（ローカルのみ）
  // globalSetupを一時的に無効化 - テストの独立性を確保するため
  // globalSetup: './e2e/fixtures/global-setup.ts',
  // Jest関連ファイルの明示的除外（クロスコンタミネーション防止）
  testIgnore: [
    '**/src/**/*.test.ts',
    '**/src/**/*.test.tsx',
    '**/jest.config.js',
    '**/jest.setup.js',
    '**/__tests__/**/*',
    '**/node_modules/**/*'
  ],
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000,
    // E2Eテスト実行中であることを示すマーカーを追加
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
    },
  },
  
  timeout: 90000, // タイムアウトを延長（プロセス分離対応）
  expect: {
    timeout: 15000, // expectタイムアウトも延長
  },

  projects: [
    // 1. Setup: 認証状態を準備
    {
      name: 'setup',
      testMatch: /setup-auth-refactored\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    
    // 2. スモークテスト（最優先）
    {
      name: 'smoke',
      dependencies: ['setup'],
      testMatch: /smoke\/.*.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      timeout: 30000,
    },
    
    // 3. コア機能テスト（auth.spec.tsを除外）
    {
      name: 'core',
      dependencies: ['setup'],
      testMatch: /core\/(?!auth).*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      timeout: 60000,
    },
    
    // 4. 追加機能テスト
    {
      name: 'features',
      dependencies: ['setup'],
      testMatch: /features\/.*.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      timeout: 60000,
    },
    
    // 5. 認証テスト（認証状態なし）
    {
      name: 'auth-tests',
      testMatch: /core\/auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
    },
    
    // 6. ブラウザ互換性テスト - Firefox
    {
      name: 'firefox',
      dependencies: ['setup'],
      testMatch: /smoke\/critical-path\.spec\.ts/,  // 重要なテストのみ
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      timeout: 60000,
    },
    
    // 7. ブラウザ互換性テスト - Safari/WebKit
    {
      name: 'webkit',
      dependencies: ['setup'],
      testMatch: /smoke\/critical-path\.spec\.ts/,  // 重要なテストのみ
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      timeout: 60000,
    },
    
    // 8. モバイルビューポート - iPhone
    {
      name: 'mobile-ios',
      dependencies: ['setup'],
      testMatch: /smoke\/critical-path\.spec\.ts/,  // 重要なテストのみ
      use: {
        ...devices['iPhone 13'],
        storageState: authFile,
      },
      timeout: 60000,
    },
    
    // 9. モバイルビューポート - Android
    {
      name: 'mobile-android',
      dependencies: ['setup'],
      testMatch: /smoke\/critical-path\.spec\.ts/,  // 重要なテストのみ
      use: {
        ...devices['Pixel 5'],
        storageState: authFile,
      },
      timeout: 60000,
    },
  ],

  webServer: process.env.NO_DEV_SERVER ? undefined : {
    command: `PORT=${PORT} npm run dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,  // 120秒
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
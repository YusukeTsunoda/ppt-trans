import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E Test Configuration
 * 関心の分離に基づいた設定
 */

// ポート番号を環境変数から取得（デフォルト: 3000）
const PORT = process.env.TEST_PORT || '3001';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// 認証状態ファイルのパス
const authFile = path.join(__dirname, 'auth.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
    // Setup: 認証状態を準備
    {
      name: 'setup',
      testMatch: /.*setup-auth-refactored\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    
    // 認証フローのテスト（認証状態を使用しない）
    {
      name: 'auth-tests',
      testMatch: /auth\/auth-flow\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // 認証状態を使用しない
        storageState: { cookies: [], origins: [] },
      },
    },
    
    // 認証済み機能のテスト（認証状態を使用）
    {
      name: 'authenticated-tests',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        // 保存された認証状態を使用
        storageState: authFile,
      },
      testIgnore: [
        /auth\/setup-auth\.ts/,
        /auth\/auth-flow\.spec\.ts/,
        /auth\/auth-comprehensive\.spec\.ts/,  // 包括的認証テストも除外
        /simple-test\.spec\.ts/,  // 基本テストも除外
        /01-auth-flow\.spec\.ts/  // 認証フローテストも除外（認証済み状態で実行すべきでない）
      ],
    },
    
    // シンプルテスト（認証不要）
    {
      name: 'simple-tests',
      testMatch: [/simple-test\.spec\.ts/, /01-auth-flow\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        // 認証状態を使用しない
        storageState: { cookies: [], origins: [] },
      },
    },
    
    // 包括的認証テスト（認証状態なし）
    {
      name: 'comprehensive-auth-tests',
      testMatch: /auth-comprehensive\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // 認証状態を使用しない（各テストが独立）
        storageState: { cookies: [], origins: [] },
      },
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
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

// 認証状態ファイルのパス（環境変数で指定可能）
const authFile = process.env.AUTH_STATE_FILE || path.join(__dirname, '.auth', 'test-auth.json');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // 順次実行に変更して競合を避ける
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // シングルワーカーで実行して認証状態の競合を避ける
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
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
        },
      },
    },
    
    // 高速実行グループ（共有認証）
    {
      name: 'critical-path',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
        },
      },
      testMatch: [
        /02-upload-flow\.spec\.ts/,
        /03-preview-flow\.spec\.ts/,
        /04-translation-flow\.spec\.ts/,
        /05-file-management\.spec\.ts/,
        /06-download-flow\.spec\.ts/,
        /07-table-cell-translation\.spec\.ts/,
      ],
    },
    
    // 独立実行グループ（認証なし）
    {
      name: 'isolated-tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
        },
      },
      testMatch: [
        /01-auth-flow\.spec\.ts/,
        /performance\.spec\.ts/,
        /simple-test\.spec\.ts/,
        /debug-login\.spec\.ts/,
      ],
    },
    
    // スキップされたテストの解決用
    {
      name: 'skipped-tests',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
        extraHTTPHeaders: {
          'X-E2E-Test': 'true',
        },
      },
      testMatch: [
        /03-skipped-tests-resolution\.spec\.ts/,
      ],
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

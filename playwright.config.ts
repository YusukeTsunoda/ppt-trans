import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { projects, ciProjects } from './e2e/config/projects';

/**
 * Playwright E2E Test Configuration
 * ハイブリッドアプローチによる段階的テスト実行
 */

// 環境変数の読み込み
dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.env.local' });

const isCI = !!process.env.CI;
const isDevelopment = process.env.NODE_ENV === 'development';

// ポート番号を環境変数から取得（デフォルト: 3000）
const PORT = process.env.TEST_PORT || '3000';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !isDevelopment, // 開発時は順次実行、CI/本番では並列実行
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : 4, // 並列ワーカー数を環境に応じて調整
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
  
  // プロジェクト設定（環境に応じて切り替え）
  projects: isCI ? ciProjects : projects,
  
  // レポーター設定
  reporter: [
    ['list'], // コンソール出力
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    isCI ? ['github'] : null,
  ].filter(Boolean) as any,
  
  use: {
    baseURL: BASE_URL,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'on',
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
    // E2Eテスト実行中であることを示すマーカーを追加
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
    },
  },
  
  timeout: 90000, // タイムアウトを延長（プロセス分離対応）
  expect: {
    timeout: 15000, // expectタイムアウトも延長
  },

  webServer: process.env.NO_DEV_SERVER ? undefined : {
    command: `PORT=${PORT} npm run dev`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,  // 120秒
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

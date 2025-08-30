import { devices, Project } from '@playwright/test';
import { TestConfig } from './test-config';

/**
 * Playwrightプロジェクト設定
 * 段階的テスト実行のための設定
 */

// 共通のuse設定
const commonUse = {
  actionTimeout: TestConfig.timeouts.action,
  navigationTimeout: TestConfig.timeouts.navigation,
  baseURL: TestConfig.baseUrl,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
};

// Smokeテストプロジェクト（5分以内）
export const smokeProject: Project = {
  name: 'smoke',
  testMatch: /smoke\/.+\.spec\.ts$/,
  timeout: 5 * 60 * 1000,
  retries: 0,
  use: {
    ...commonUse,
    ...devices['Desktop Chrome'],
    // 認証なしで実行
    storageState: undefined,
    // デバッグのため一時的にヘッドフルモード
    headless: false,
    // エラー時のデバッグ用にスクリーンショットを有効化
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
};

// Coreテストプロジェクト（15分以内）
export const coreProject: Project = {
  name: 'core',
  testMatch: /core\/.+\.spec\.ts$/,
  timeout: 15 * 60 * 1000,
  retries: 1,
  // setupの依存関係を一時的に削除（段階的移行のため）
  // dependencies: ['setup'],
  use: {
    ...commonUse,
    ...devices['Desktop Chrome'],
    // 認証済み状態は各テストで個別に処理
    // storageState: '.auth/user.json',
    // パフォーマンス測定有効
    launchOptions: {
      args: ['--enable-precise-memory-info'],
    },
  },
};

// Server Actionsテストプロジェクト
export const serverActionsProject: Project = {
  name: 'server-actions',
  testMatch: /server-actions\/.+\.spec\.ts$/,
  timeout: 30 * 60 * 1000,
  retries: 1,
  use: {
    ...commonUse,
    ...devices['Desktop Chrome'],
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Server Actions用のヘッダー
    extraHTTPHeaders: {
      'X-E2E-Test': 'true',
    },
  },
};

// Regressionテストプロジェクト（45分以内）
export const regressionProject: Project = {
  name: 'regression',
  testMatch: /regression\/.+\.spec\.ts$/,
  timeout: 45 * 60 * 1000,
  retries: 2,
  dependencies: ['setup'],
  use: {
    ...commonUse,
    ...devices['Desktop Chrome'],
    storageState: '.auth/user.json',
    // 詳細なデバッグ情報を収集
    trace: 'on',
    video: 'on',
    screenshot: 'on',
  },
};

// セットアップ・ティアダウンプロジェクト
export const setupProject: Project = {
  name: 'setup',
  testMatch: /fixtures\/auth\.setup\.ts/,
  teardown: 'cleanup',
};

export const cleanupProject: Project = {
  name: 'cleanup',
  testMatch: /fixtures\/global\.teardown\.ts/,
};

// 全プロジェクトをエクスポート
export const projects = [
  setupProject,
  smokeProject,
  coreProject,
  serverActionsProject,
  regressionProject,
  cleanupProject,
];

// CI環境用の軽量設定
export const ciProjects = [
  setupProject,
  smokeProject,
  coreProject,
  cleanupProject,
];
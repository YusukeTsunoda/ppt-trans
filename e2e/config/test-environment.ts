/**
 * E2E Test Environment Configuration
 * QAエキスパート観点での環境設定管理
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// Load E2E specific environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });

/**
 * E2E環境変数のスキーマ定義
 * 型安全性と必須項目の検証
 */
const e2eEnvSchema = z.object({
  // Application
  E2E_BASE_URL: z.string().url().default('http://localhost:3000'),
  E2E_TIMEOUT: z.string().transform(Number).default('30000'),
  E2E_RETRY_COUNT: z.string().transform(Number).default('2'),
  E2E_HEADLESS: z.string().transform(v => v === 'true').default('true'),
  E2E_SLOW_MO: z.string().transform(Number).default('0'),
  
  // Test Users
  E2E_TEST_USER_EMAIL: z.string().email().default(`test.${Date.now()}@example.com`),
  E2E_TEST_USER_PASSWORD: z.string().min(8).default(generateSecurePassword()),
  E2E_ADMIN_USER_EMAIL: z.string().email().default(`admin.${Date.now()}@example.com`),
  E2E_ADMIN_USER_PASSWORD: z.string().min(8).default(generateSecurePassword()),
  
  // CSRF
  E2E_CSRF_TEST_TOKEN: z.string().default(generateTestToken()),
  E2E_CSRF_BYPASS_HEADER: z.string().default('x-e2e-bypass'),
  CSRF_RELAXED_IN_E2E: z.string().transform(v => v === 'true').default('true'),
  
  // Database
  E2E_DATABASE_URL: z.string().optional(),
  
  // Test Data
  E2E_TEST_FILE_PATH: z.string().default('./e2e/fixtures/test-presentation.pptx'),
  E2E_MAX_FILE_SIZE: z.string().transform(Number).default('10485760'),
  E2E_ALLOWED_EXTENSIONS: z.string().default('.pptx,.ppt'),
  
  // Features
  E2E_ENABLE_SECURITY_TESTS: z.string().transform(v => v === 'true').default('true'),
  E2E_ENABLE_PERFORMANCE_TESTS: z.string().transform(v => v === 'true').default('false'),
  E2E_ENABLE_ACCESSIBILITY_TESTS: z.string().transform(v => v === 'true').default('true'),
  
  // Logging
  E2E_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  E2E_SCREENSHOT_ON_FAILURE: z.string().transform(v => v === 'true').default('true'),
  E2E_VIDEO_ON_FAILURE: z.string().transform(v => v === 'true').default('false'),
  
  // Rate Limiting
  E2E_RATE_LIMIT_BYPASS: z.string().transform(v => v === 'true').default('true'),
  DISABLE_RATE_LIMIT_IN_E2E: z.string().transform(v => v === 'true').default('true'),
  
  // Origin Check
  DISABLE_ORIGIN_CHECK_IN_E2E: z.string().transform(v => v === 'true').default('true'),
});

/**
 * セキュアなパスワード生成
 */
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  return Array.from(crypto.randomBytes(16))
    .map(byte => chars[byte % chars.length])
    .join('');
}

/**
 * テストトークン生成
 */
function generateTestToken(): string {
  return `e2e-csrf-test-${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * 環境変数の検証と取得
 */
const parseResult = e2eEnvSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ E2E環境変数の検証エラー:');
  console.error(parseResult.error.format());
  
  // 開発環境では警告のみ、CIでは失敗
  if (process.env.CI === 'true') {
    process.exit(1);
  }
}

export const testEnv = parseResult.success ? parseResult.data : e2eEnvSchema.parse({});

/**
 * テストユーザー設定
 */
export const testUsers = {
  standard: {
    email: testEnv.E2E_TEST_USER_EMAIL,
    password: testEnv.E2E_TEST_USER_PASSWORD,
    role: 'user' as const,
  },
  admin: {
    email: testEnv.E2E_ADMIN_USER_EMAIL,
    password: testEnv.E2E_ADMIN_USER_PASSWORD,
    role: 'admin' as const,
  },
  // 動的に生成されるユニークユーザー
  unique: () => ({
    email: `test.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`,
    password: generateSecurePassword(),
    role: 'user' as const,
  }),
};

/**
 * CSRF設定
 */
export const csrfConfig = {
  testToken: testEnv.E2E_CSRF_TEST_TOKEN,
  bypassHeader: testEnv.E2E_CSRF_BYPASS_HEADER,
  relaxed: testEnv.CSRF_RELAXED_IN_E2E,
  
  // テスト用のCSRFヘッダー生成
  getHeaders: () => ({
    [testEnv.E2E_CSRF_BYPASS_HEADER]: testEnv.E2E_CSRF_TEST_TOKEN,
  }),
};

/**
 * アプリケーション設定
 */
export const appConfig = {
  baseUrl: testEnv.E2E_BASE_URL,
  timeout: testEnv.E2E_TIMEOUT,
  retryCount: testEnv.E2E_RETRY_COUNT,
  headless: testEnv.E2E_HEADLESS,
  slowMo: testEnv.E2E_SLOW_MO,
};

/**
 * テストデータ設定
 */
export const testDataConfig = {
  testFilePath: testEnv.E2E_TEST_FILE_PATH,
  maxFileSize: testEnv.E2E_MAX_FILE_SIZE,
  allowedExtensions: testEnv.E2E_ALLOWED_EXTENSIONS.split(','),
};

/**
 * 機能フラグ
 */
export const featureFlags = {
  security: testEnv.E2E_ENABLE_SECURITY_TESTS,
  performance: testEnv.E2E_ENABLE_PERFORMANCE_TESTS,
  accessibility: testEnv.E2E_ENABLE_ACCESSIBILITY_TESTS,
};

/**
 * ログ設定
 */
export const logConfig = {
  level: testEnv.E2E_LOG_LEVEL,
  screenshotOnFailure: testEnv.E2E_SCREENSHOT_ON_FAILURE,
  videoOnFailure: testEnv.E2E_VIDEO_ON_FAILURE,
};

/**
 * テスト環境のサマリー出力
 */
export function printTestEnvironment() {
  console.log('🧪 E2E Test Environment Configuration');
  console.log('=====================================');
  console.log(`📍 Base URL: ${appConfig.baseUrl}`);
  console.log(`👤 Test User: ${testUsers.standard.email}`);
  console.log(`🔐 CSRF Mode: ${csrfConfig.relaxed ? 'Relaxed' : 'Strict'}`);
  console.log(`🎯 Features: Security=${featureFlags.security}, Performance=${featureFlags.performance}, A11y=${featureFlags.accessibility}`);
  console.log(`📊 Logging: Level=${logConfig.level}, Screenshots=${logConfig.screenshotOnFailure}`);
  console.log('=====================================\n');
}
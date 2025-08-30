/**
 * Global Setup for E2E Tests
 * QAエキスパート観点でのテスト環境準備
 */

import { chromium, FullConfig } from '@playwright/test';
import { testEnv, testUsers, printTestEnvironment } from '../config/test-environment';
import dotenv from 'dotenv';
import path from 'path';

// E2E環境変数を読み込み
dotenv.config({ path: path.resolve(process.cwd(), '.env.e2e') });

async function globalSetup(config: FullConfig) {
  console.log('\n🚀 E2E Test Global Setup Starting...\n');
  
  // 環境情報を出力
  printTestEnvironment();
  
  // 環境変数の検証
  validateEnvironment();
  
  // テストユーザーの準備（必要に応じて）
  if (process.env.E2E_CREATE_TEST_USERS === 'true') {
    await createTestUsers();
  }
  
  // CSRFトークンの事前取得（オプション）
  if (process.env.E2E_PREFETCH_CSRF === 'true') {
    await prefetchCSRFToken();
  }
  
  console.log('✅ Global Setup Completed\n');
}

/**
 * 環境変数の検証
 */
function validateEnvironment() {
  const requiredVars = [
    'E2E_BASE_URL',
    'E2E_TEST_USER_EMAIL',
    'E2E_TEST_USER_PASSWORD',
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('⚠️ Missing environment variables:', missingVars);
    console.warn('   Using default values from test-environment.ts\n');
  }
  
  // セキュリティチェック
  if (process.env.DATABASE_URL?.includes('production')) {
    throw new Error('🚨 CRITICAL: Production database detected in E2E tests!');
  }
  
  if (process.env.E2E_BASE_URL?.includes('production')) {
    console.warn('⚠️ WARNING: Testing against production URL!');
  }
}

/**
 * テストユーザーの作成
 */
async function createTestUsers() {
  console.log('👤 Creating test users...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // 管理者APIを使用してテストユーザーを作成
    const users = [testUsers.standard, testUsers.admin];
    
    for (const user of users) {
      const response = await page.request.post(
        `${testEnv.E2E_BASE_URL}/api/admin/create-test-user`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': process.env.E2E_ADMIN_API_KEY || '',
          },
          data: {
            email: user.email,
            password: user.password,
            role: user.role,
          },
        }
      );
      
      if (response.ok()) {
        console.log(`   ✅ Created ${user.role} user: ${user.email}`);
      } else {
        console.warn(`   ⚠️ Failed to create ${user.role} user: ${response.status()}`);
      }
    }
  } catch (error) {
    console.error('   ❌ Error creating test users:', error);
  } finally {
    await browser.close();
  }
}

/**
 * CSRFトークンの事前取得
 */
async function prefetchCSRFToken() {
  console.log('🔐 Prefetching CSRF token...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const response = await page.request.get(
      `${testEnv.E2E_BASE_URL}/api/auth/csrf`
    );
    
    if (response.ok()) {
      const { csrfToken } = await response.json();
      process.env.E2E_PREFETCHED_CSRF_TOKEN = csrfToken;
      console.log('   ✅ CSRF token prefetched successfully');
    } else {
      console.warn('   ⚠️ Failed to prefetch CSRF token');
    }
  } catch (error) {
    console.error('   ❌ Error prefetching CSRF token:', error);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
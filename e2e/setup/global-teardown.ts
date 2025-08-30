/**
 * Global Teardown for E2E Tests
 * テスト環境のクリーンアップ
 */

import { chromium, FullConfig } from '@playwright/test';
import { testEnv, testUsers } from '../config/test-environment';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 E2E Test Global Teardown Starting...\n');
  
  // テストユーザーのクリーンアップ
  if (process.env.E2E_CLEANUP_TEST_USERS === 'true') {
    await cleanupTestUsers();
  }
  
  // テストデータのクリーンアップ
  if (process.env.E2E_CLEANUP_TEST_DATA === 'true') {
    await cleanupTestData();
  }
  
  // テスト結果のサマリー出力
  outputTestSummary();
  
  console.log('✅ Global Teardown Completed\n');
}

/**
 * テストユーザーのクリーンアップ
 */
async function cleanupTestUsers() {
  console.log('🗑️ Cleaning up test users...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    const users = [testUsers.standard.email, testUsers.admin.email];
    
    for (const email of users) {
      const response = await page.request.delete(
        `${testEnv.E2E_BASE_URL}/api/admin/delete-test-user`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Key': process.env.E2E_ADMIN_API_KEY || '',
          },
          data: { email },
        }
      );
      
      if (response.ok()) {
        console.log(`   ✅ Deleted test user: ${email}`);
      } else {
        console.warn(`   ⚠️ Failed to delete test user: ${email}`);
      }
    }
  } catch (error) {
    console.error('   ❌ Error cleaning up test users:', error);
  } finally {
    await browser.close();
  }
}

/**
 * テストデータのクリーンアップ
 */
async function cleanupTestData() {
  console.log('🗑️ Cleaning up test data...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // テストで作成されたファイルのクリーンアップ
    const response = await page.request.post(
      `${testEnv.E2E_BASE_URL}/api/admin/cleanup-test-data`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': process.env.E2E_ADMIN_API_KEY || '',
        },
        data: {
          pattern: 'test_*',
          olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24時間以上前
        },
      }
    );
    
    if (response.ok()) {
      const { deletedCount } = await response.json();
      console.log(`   ✅ Cleaned up ${deletedCount} test files`);
    } else {
      console.warn('   ⚠️ Failed to cleanup test data');
    }
  } catch (error) {
    console.error('   ❌ Error cleaning up test data:', error);
  } finally {
    await browser.close();
  }
}

/**
 * テスト結果のサマリー出力
 */
function outputTestSummary() {
  console.log('\n📊 Test Execution Summary');
  console.log('========================');
  
  // テスト実行時間
  const executionTime = process.env.E2E_EXECUTION_TIME || 'N/A';
  console.log(`⏱️ Total Execution Time: ${executionTime}`);
  
  // テスト結果統計（CI環境で利用可能な場合）
  if (process.env.E2E_PASSED_COUNT) {
    console.log(`✅ Passed: ${process.env.E2E_PASSED_COUNT}`);
  }
  if (process.env.E2E_FAILED_COUNT) {
    console.log(`❌ Failed: ${process.env.E2E_FAILED_COUNT}`);
  }
  if (process.env.E2E_SKIPPED_COUNT) {
    console.log(`⏭️ Skipped: ${process.env.E2E_SKIPPED_COUNT}`);
  }
  
  // パフォーマンスメトリクス
  if (process.env.E2E_AVG_RESPONSE_TIME) {
    console.log(`📈 Average Response Time: ${process.env.E2E_AVG_RESPONSE_TIME}ms`);
  }
  
  console.log('========================\n');
}

export default globalTeardown;
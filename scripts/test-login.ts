import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const testUserEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
const testUserPassword = process.env.TEST_USER_PASSWORD || 'Test123';

async function testLogin() {
  console.log('🚀 ログインテストを開始...');
  console.log(`📧 Email: ${testUserEmail}`);
  console.log(`🔑 Password: ${testUserPassword.replace(/./g, '*')}`);
  console.log(`🌐 URL: http://localhost:3000`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log('📍 ログインページへ移動中...');
    await page.goto('http://localhost:3000/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'test-login-page.png' });
    console.log('📸 スクリーンショット保存: test-login-page.png');
    
    // Find and fill email
    console.log('📝 メールアドレスを入力中...');
    const emailInput = page.locator('input[type="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(testUserEmail);
    
    // Find and fill password
    console.log('🔑 パスワードを入力中...');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 5000 });
    await passwordInput.fill(testUserPassword);
    
    // Take screenshot before submit
    await page.screenshot({ path: 'test-login-filled.png' });
    console.log('📸 入力後のスクリーンショット: test-login-filled.png');
    
    // Click login button
    console.log('🖱️ ログインボタンをクリック...');
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Wait for navigation or error
    console.log('⏳ 結果を待機中...');
    
    try {
      // Wait for either success (navigation) or error message
      await Promise.race([
        page.waitForURL('**/dashboard', { timeout: 10000 }),
        page.waitForURL('**/upload', { timeout: 10000 }),
        page.locator('text=/エラー|失敗|正しくありません/i').waitFor({ state: 'visible', timeout: 10000 })
      ]);
      
      const currentUrl = page.url();
      console.log(`📍 現在のURL: ${currentUrl}`);
      
      if (currentUrl.includes('dashboard') || currentUrl.includes('upload')) {
        console.log('✅ ログイン成功！');
      } else {
        console.log('❌ ログインは完了しましたが、予期しないページです');
      }
    } catch (error) {
      console.log('⚠️  タイムアウトまたはエラー');
      
      // Check for error messages
      const errorMessages = await page.locator('[role="alert"], .text-red-700, .text-red-400').allTextContents();
      if (errorMessages.length > 0) {
        console.log('❌ エラーメッセージ:');
        errorMessages.forEach(msg => console.log(`   - ${msg}`));
      }
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-login-result.png' });
    console.log('📸 最終スクリーンショット: test-login-result.png');
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    // Keep browser open for inspection
    console.log('⏸️  ブラウザを開いたままにします。Ctrl+Cで終了してください。');
    await new Promise(() => {}); // Keep running
  }
}

// Run the test
testLogin().catch(error => {
  console.error('❌ スクリプトエラー:', error);
  process.exit(1);
});
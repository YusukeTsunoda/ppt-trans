import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const testUserEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
const testUserPassword = process.env.TEST_USER_PASSWORD || 'Test123';

async function debugLogin() {
  console.log('🚀 デバッグログインテストを開始...');
  console.log(`📧 Email: ${testUserEmail}`);
  console.log(`🔑 Password: ${testUserPassword.replace(/./g, '*')}`);

  const browser = await chromium.launch({ 
    headless: false,
    devtools: true // Open devtools
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log('🔴 Browser Error:', text);
    } else if (type === 'warning') {
      console.log('🟡 Browser Warning:', text);
    } else if (text.includes('action') || text.includes('Action')) {
      console.log('🔵 Browser Log:', text);
    }
  });

  // Listen to network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('login') || url.includes('auth') || url.includes('action')) {
      console.log(`📤 Request: ${request.method()} ${url}`);
    }
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('login') || url.includes('auth') || url.includes('action')) {
      console.log(`📥 Response: ${response.status()} ${url}`);
    }
  });

  try {
    // Navigate to login page
    console.log('📍 ログインページへ移動中...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    
    // Check page content
    const pageTitle = await page.title();
    console.log(`📄 Page Title: ${pageTitle}`);
    
    // Check for form
    const formExists = await page.locator('form').count();
    console.log(`📝 Forms found: ${formExists}`);
    
    // Fill form
    console.log('📝 フォームに入力中...');
    await page.fill('input[type="email"]', testUserEmail);
    await page.fill('input[type="password"]', testUserPassword);
    
    // Check form action
    const formAction = await page.locator('form').getAttribute('action');
    console.log(`🎯 Form action: ${formAction || 'JavaScript action'}`);
    
    // Get button info
    const buttonText = await page.locator('button[type="submit"]').first().textContent();
    console.log(`🔘 Submit button text: ${buttonText}`);
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Click with more details
    console.log('🖱️ ログインボタンをクリック...');
    await page.locator('button[type="submit"]').first().click();
    
    // Wait and observe
    console.log('⏳ 5秒間待機して観察...');
    await page.waitForTimeout(5000);
    
    // Check final state
    const finalUrl = page.url();
    console.log(`📍 最終URL: ${finalUrl}`);
    
    // Check for any error messages
    const alerts = await page.locator('[role="alert"], .bg-red-50, .text-red-700').allTextContents();
    if (alerts.length > 0) {
      console.log('❌ エラーメッセージ:');
      alerts.forEach(msg => console.log(`   - ${msg}`));
    }
    
    // Check cookies
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth'));
    if (authCookie) {
      console.log('🍪 認証クッキー found:', authCookie.name);
    } else {
      console.log('❌ 認証クッキーが見つかりません');
    }
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
  
  console.log('⏸️  ブラウザを開いたままにします。Ctrl+Cで終了してください。');
  await new Promise(() => {}); // Keep running
}

// Run the test
debugLogin().catch(error => {
  console.error('❌ スクリプトエラー:', error);
  process.exit(1);
});
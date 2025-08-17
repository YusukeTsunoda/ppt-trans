import { test as setup } from '@playwright/test';
import path from 'path';
import { TEST_CONFIG, URL_PATTERNS, getTimeout } from '../config/test-config';
import { SELECTORS } from '../config/selectors';

/**
 * リファクタリング版：認証セットアップ
 * ハードコーディングを排除し、エラーハンドリングを強化
 */

async function attemptLogin(page: any, attempt: number = 1): Promise<boolean> {
  console.log(`🔐 認証試行 ${attempt}/${TEST_CONFIG.auth.maxRetries}...`);
  
  try {
    // ログインページへ移動
    await page.goto('/login', { 
      waitUntil: 'networkidle',
      timeout: getTimeout('navigation')
    });
    
    // フォーム要素が表示されるまで待機
    await page.waitForSelector(SELECTORS.auth.emailInput, { 
      state: 'visible', 
      timeout: getTimeout('elementVisible')
    });
    
    // 認証情報を入力
    await page.fill(SELECTORS.auth.emailInput, TEST_CONFIG.auth.email);
    await page.fill(SELECTORS.auth.passwordInput, TEST_CONFIG.auth.password);
    
    // デバッグ情報
    console.log(`📧 Email: ${TEST_CONFIG.auth.email}`);
    console.log(`🔑 Password: ${TEST_CONFIG.auth.password.replace(/./g, '*')}`);
    
    // ログインボタンをクリック
    const submitButton = page.locator(SELECTORS.auth.submitButton).first();
    
    // ボタンが有効になるまで待つ
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();
    
    // 認証結果を待つ（複数の成功条件）
    const successConditions = [
      page.waitForURL(URL_PATTERNS.dashboard, { timeout: getTimeout('navigation') }),
      page.waitForURL(URL_PATTERNS.upload, { timeout: getTimeout('navigation') }),
      page.waitForSelector(SELECTORS.auth.successMessage, { 
        state: 'visible', 
        timeout: getTimeout('elementVisible') 
      })
    ];
    
    try {
      await Promise.race(successConditions);
      console.log('✅ 認証成功！');
      return true;
    } catch (navError) {
      // エラーメッセージを確認
      const errorElement = page.locator(SELECTORS.auth.errorMessage).first();
      const hasError = await errorElement.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasError) {
        const errorText = await errorElement.textContent();
        console.error(`❌ 認証エラー: ${errorText}`);
        
        // パスワードが間違っている可能性を検証
        if (errorText?.includes('パスワード')) {
          console.log('💡 ヒント: パスワードを確認してください');
          console.log(`   環境変数 TEST_USER_PASSWORD: ${process.env.TEST_USER_PASSWORD || '未設定'}`);
          console.log(`   デフォルト値: Test123!@#`);
        }
      }
      
      return false;
    }
  } catch (error) {
    console.error(`❌ 認証試行 ${attempt} 失敗:`, error);
    return false;
  }
}

setup('authenticate', async ({ page, context, baseURL }) => {
  console.log('🚀 認証セットアップを開始...');
  console.log(`📍 Base URL: ${baseURL}`);
  console.log(`🔧 環境変数:`, {
    TEST_USER_EMAIL: process.env.TEST_USER_EMAIL || '未設定',
    TEST_USER_PASSWORD: process.env.TEST_USER_PASSWORD ? '設定済み' : '未設定',
    USE_MSW_MOCKS: process.env.USE_MSW_MOCKS || '未設定'
  });
  
  let authenticated = false;
  
  // リトライロジック
  for (let attempt = 1; attempt <= TEST_CONFIG.auth.maxRetries; attempt++) {
    authenticated = await attemptLogin(page, attempt);
    
    if (authenticated) {
      break;
    }
    
    if (attempt < TEST_CONFIG.auth.maxRetries) {
      console.log(`⏳ ${TEST_CONFIG.auth.retryDelay}ms 待機後にリトライ...`);
      await page.waitForTimeout(TEST_CONFIG.auth.retryDelay);
    }
  }
  
  if (!authenticated) {
    // 最終的に失敗した場合のフォールバック
    console.error('❌ すべての認証試行が失敗しました');
    
    // スクリーンショットを保存
    const screenshotPath = path.join('test-results', 'auth-setup-failure-final.png');
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    console.log(`📸 スクリーンショット保存: ${screenshotPath}`);
    
    // MSWモードの提案
    if (!process.env.USE_MSW_MOCKS) {
      console.log('\n💡 提案: MSWモックを有効にしてテストを実行してください');
      console.log('   USE_MSW_MOCKS=true npm run test:e2e');
    }
    
    // エラー詳細を含めて失敗
    throw new Error(
      '認証セットアップに失敗しました。\n' +
      '以下を確認してください:\n' +
      '1. テストユーザーが存在するか\n' +
      '2. パスワードが正しいか (Test123!@#)\n' +
      '3. Supabaseが起動しているか\n' +
      '4. ネットワーク接続が正常か'
    );
  }
  
  // 認証状態を保存
  try {
    await context.storageState({ path: TEST_CONFIG.auth.storageStateFile });
    console.log(`💾 認証状態を ${TEST_CONFIG.auth.storageStateFile} に保存しました`);
  } catch (saveError) {
    console.error('❌ 認証状態の保存に失敗:', saveError);
    throw saveError;
  }
  
  // セッション情報をログ（デバッグ用）
  if (process.env.LOG_LEVEL === 'debug') {
    const cookies = await context.cookies();
    console.log(`🍪 Cookies数: ${cookies.length}`);
    
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });
    console.log(`💾 LocalStorage キー:`, Object.keys(localStorage));
  }
  
  console.log('✅ 認証セットアップ完了！');
});
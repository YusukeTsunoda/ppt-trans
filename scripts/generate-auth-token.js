#!/usr/bin/env node

/**
 * 動的認証トークン生成スクリプト
 * E2Eテスト用の短命な認証トークンを生成
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

// 環境変数から設定を読み込み
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_STATE_FILE = process.env.AUTH_STATE_FILE || '.auth/test-auth.json';

// トークンの有効期限（デフォルト: 2時間）
const TOKEN_LIFETIME_HOURS = parseInt(process.env.TOKEN_LIFETIME_HOURS || '2');

async function generateAuthToken() {
  console.log('🔐 認証トークン生成を開始...');
  console.log(`📧 ユーザー: ${TEST_USER_EMAIL}`);
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log(`⏰ トークン有効期限: ${TOKEN_LIFETIME_HOURS}時間`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // ログインページへ移動
    console.log('📍 ログインページへ移動...');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // ログイン実行
    console.log('🔑 ログイン実行中...');
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]:has-text("ログイン")');

    // ログイン成功を待つ
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      console.log('✅ ログイン成功！');
    } catch (error) {
      console.error('❌ ログイン失敗:', error.message);
      
      // エラーメッセージを取得
      const errorElement = await page.locator('[role="alert"], .error, .text-red-500').first();
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        console.error('エラーメッセージ:', errorText);
      }
      
      throw new Error('ログインに失敗しました');
    }

    // 認証状態を保存
    const authDir = path.dirname(AUTH_STATE_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    await context.storageState({ path: AUTH_STATE_FILE });
    console.log(`💾 認証状態を ${AUTH_STATE_FILE} に保存しました`);

    // トークン情報を取得して有効期限を確認
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => 
      c.name.includes('auth') || c.name.includes('session') || c.name.includes('sb-')
    );

    if (authCookie) {
      const expiresDate = new Date(authCookie.expires * 1000);
      console.log(`🕐 トークン有効期限: ${expiresDate.toLocaleString('ja-JP')}`);
      
      // 有効期限が短すぎる場合は警告
      const hoursUntilExpiry = (authCookie.expires * 1000 - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < TOKEN_LIFETIME_HOURS) {
        console.warn(`⚠️ トークンの有効期限が短いです: ${hoursUntilExpiry.toFixed(1)}時間`);
      }
    }

    // メタデータを保存
    const metadata = {
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TOKEN_LIFETIME_HOURS * 60 * 60 * 1000).toISOString(),
      user: TEST_USER_EMAIL,
      environment: process.env.NODE_ENV || 'test'
    };

    fs.writeFileSync(
      path.join(authDir, 'auth-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('✅ 認証トークン生成完了！');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// トークンの有効性をチェック
function checkTokenValidity() {
  const metadataFile = path.join(path.dirname(AUTH_STATE_FILE), 'auth-metadata.json');
  
  if (!fs.existsSync(AUTH_STATE_FILE)) {
    console.log('⚠️ 認証ファイルが存在しません');
    return false;
  }

  if (!fs.existsSync(metadataFile)) {
    console.log('⚠️ メタデータファイルが存在しません');
    return false;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
    const expiresAt = new Date(metadata.expiresAt);
    const now = new Date();

    if (now > expiresAt) {
      console.log('⚠️ トークンの有効期限が切れています');
      return false;
    }

    const hoursRemaining = (expiresAt - now) / (1000 * 60 * 60);
    console.log(`✅ トークンは有効です（残り ${hoursRemaining.toFixed(1)} 時間）`);
    return true;

  } catch (error) {
    console.error('❌ メタデータの読み込みエラー:', error);
    return false;
  }
}

// メイン処理
async function main() {
  // --checkオプションで有効性チェックのみ実行
  if (process.argv.includes('--check')) {
    const isValid = checkTokenValidity();
    process.exit(isValid ? 0 : 1);
  }

  // --forceオプションまたはトークンが無効な場合は再生成
  if (process.argv.includes('--force') || !checkTokenValidity()) {
    await generateAuthToken();
  } else {
    console.log('ℹ️ 既存のトークンを使用します（再生成するには --force を使用）');
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ 予期しないエラー:', error);
  process.exit(1);
});

// 実行
main().catch(error => {
  console.error('❌ 実行エラー:', error);
  process.exit(1);
});
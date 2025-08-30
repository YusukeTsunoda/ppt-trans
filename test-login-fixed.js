/**
 * LoginFormFixedのテストスクリプト
 * Server Actionsが正しく動作するか確認
 */

const puppeteer = require('puppeteer');

async function testLoginFixed() {
  const browser = await puppeteer.launch({ 
    headless: false,  // ブラウザを表示
    devtools: true    // デベロッパーツールを開く
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('🔍 ログインページにアクセス...');
    await page.goto('http://localhost:3003/login', {
      waitUntil: 'networkidle0'
    });
    
    // ページのスクリーンショットを撮影
    await page.screenshot({ path: 'login-page.png' });
    console.log('📸 スクリーンショット保存: login-page.png');
    
    // フォームアクション属性を確認
    const formAction = await page.evaluate(() => {
      const form = document.querySelector('form');
      return form ? form.action : null;
    });
    
    console.log('📋 フォームアクション:', formAction);
    
    // Server Action関数が正しく設定されているか確認
    if (formAction && formAction.includes('javascript:')) {
      console.log('❌ エラー: Server Actionが正しく設定されていません');
      console.log('   現在の値:', formAction);
    } else {
      console.log('✅ Server Actionが正しく設定されています');
    }
    
    // 実際にログインをテスト（テスト環境の場合）
    if (process.env.TEST_MODE) {
      console.log('📝 フォームに入力...');
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'Test1234!');
      
      console.log('🚀 フォームを送信...');
      await Promise.all([
        page.waitForNavigation({ timeout: 10000 }),
        page.click('button[type="submit"]')
      ]).catch(e => {
        console.log('⚠️  リダイレクトまたはエラーが発生:', e.message);
      });
      
      const currentUrl = page.url();
      console.log('📍 現在のURL:', currentUrl);
      
      if (currentUrl.includes('/dashboard')) {
        console.log('✅ ログイン成功！ダッシュボードにリダイレクトされました');
      } else if (currentUrl.includes('/login')) {
        // エラーメッセージを確認
        const errorMessage = await page.evaluate(() => {
          const alert = document.querySelector('[role="alert"]');
          return alert ? alert.textContent : null;
        });
        console.log('⚠️  ログインページに留まっています');
        if (errorMessage) {
          console.log('   エラーメッセージ:', errorMessage);
        }
      }
    }
    
    console.log('\n✅ テスト完了');
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  } finally {
    await browser.close();
  }
}

// 実行
testLoginFixed().catch(console.error);
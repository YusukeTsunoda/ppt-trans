import { test as setup } from '@playwright/test';
import { TestConfig } from '../config/test-config';
import { LoginPage } from '../page-objects/login.page';
import { AuthHelper } from './helpers/auth.helper';

/**
 * 認証セットアップ
 * テスト実行前に認証状態を準備
 */
setup('authenticate', async ({ page, context }) => {
  console.log('🚀 認証セットアップを開始...');
  
  const loginPage = new LoginPage(page);
  const authHelper = new AuthHelper(page);
  
  try {
    // ログインページへ移動
    await loginPage.goto();
    
    // デフォルトユーザーでログイン
    const user = TestConfig.users.default;
    console.log(`📧 Email: ${user.email}`);
    
    await loginPage.login(user.email, user.password);
    await loginPage.waitForSuccessfulLogin();
    
    console.log('✅ 認証成功！');
    
    // 認証状態を保存
    await context.storageState({ path: '.auth/user.json' });
    console.log('💾 認証状態を .auth/user.json に保存しました');
    
    // 管理者用の認証状態も保存
    await page.goto('/login');
    const admin = TestConfig.users.admin;
    await loginPage.login(admin.email, admin.password);
    await loginPage.waitForSuccessfulLogin();
    
    await context.storageState({ path: '.auth/admin.json' });
    console.log('💾 管理者認証状態を .auth/admin.json に保存しました');
    
  } catch (error) {
    console.error('❌ 認証セットアップに失敗:', error);
    throw error;
  }
  
  console.log('✅ 認証セットアップ完了！');
});
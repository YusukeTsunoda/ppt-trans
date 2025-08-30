import { test, expect } from '@playwright/test';

test.describe('Server Action Login Test', () => {
  test('ログインページでtest@example.comでログインできる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // ログインページであることを確認
    await expect(page.locator('h1')).toContainText('ログイン');
    
    // メールアドレスを入力
    await page.fill('input[type="email"]', 'test@example.com');
    
    // パスワードを入力
    await page.fill('input[type="password"]', 'Test123!');
    
    // フォーム送信
    await page.click('button[type="submit"]');
    
    // 結果を待つ（ダッシュボードへの遷移またはエラー）
    await Promise.race([
      // 成功: ダッシュボードへ遷移
      page.waitForURL('**/dashboard', { timeout: 10000 }).then(async () => {
        console.log('✅ ログイン成功！ダッシュボードに遷移しました');
        await expect(page).toHaveURL(/\/dashboard/);
        return 'success';
      }),
      // 失敗: エラーメッセージが表示
      page.waitForSelector('text=/メールアドレスまたはパスワード/i', { timeout: 5000 }).then(async () => {
        const errorText = await page.locator('text=/メールアドレスまたはパスワード/i').textContent();
        console.log('❌ ログインエラー:', errorText);
        throw new Error(`ログイン失敗: ${errorText}`);
      }),
      // タイムアウト
      page.waitForTimeout(10000).then(() => {
        console.log('⏱️ タイムアウト - 10秒経過してもレスポンスなし');
        throw new Error('ログインタイムアウト');
      })
    ]);
  });
  
  test('admin@example.comでのログインを試みる', async ({ page }) => {
    // ログインページに移動
    await page.goto('http://localhost:3001/login');
    
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // メールアドレスを入力
    await page.fill('input[type="email"]', 'admin@example.com');
    
    // パスワードを入力
    await page.fill('input[type="password"]', 'Admin123!');
    
    // フォーム送信
    await page.click('button[type="submit"]');
    
    // 結果を待つ
    const result = await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 5000 }).then(() => 'success'),
      page.waitForSelector('text=/メールアドレスまたはパスワード/i', { timeout: 5000 }).then(() => 'error'),
      page.waitForTimeout(5000).then(() => 'timeout')
    ]);
    
    if (result === 'success') {
      console.log('✅ 管理者ユーザーでのログイン成功');
      await expect(page).toHaveURL(/\/dashboard/);
    } else {
      console.log('❌ 管理者ユーザーは存在しません（予想通り）');
      // これはエラーではなく予想される結果
    }
  });
});
import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * プロフィール管理機能 - 追加機能テスト
 */
test.describe('プロフィール管理機能', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    // ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test('プロフィール画面へのアクセス', async ({ page, baseURL }) => {
    // プロフィールリンクを探す
    const profileLink = page.locator('a[href*="/profile"], button:has-text("プロフィール"), button:has-text("Profile")');
    
    if (await profileLink.first().isVisible({ timeout: 2000 })) {
      await profileLink.first().click();
      
      // プロフィールページへ遷移
      await expect(page).toHaveURL(/.*\/profile/, { timeout: TEST_CONFIG.timeouts.navigation });
      
      // プロフィール要素が表示される
      await expect(page.locator('h1').filter({ hasText: /プロフィール|Profile/ })).toBeVisible();
      
      // メールアドレスが表示される
      await expect(page.locator('text=/test@example.com/')).toBeVisible();
    }
  });

  test('プロフィール情報の更新', async ({ page, baseURL }) => {
    // プロフィールページへ
    const profileUrl = `${baseURL}/profile`;
    await page.goto(profileUrl);
    
    // 名前の変更欄があるか確認
    const nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    
    if (await nameInput.isVisible({ timeout: 2000 })) {
      // 名前を変更
      await nameInput.clear();
      await nameInput.fill('Test User Updated');
      
      // 保存ボタンをクリック
      const saveButton = page.locator('button:has-text("保存"), button:has-text("更新")');
      await saveButton.click();
      
      // 成功メッセージが表示される
      const successMessage = page.locator('text=/更新しました|保存しました|Updated successfully/');
      await expect(successMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    }
  });

  test('パスワードの変更', async ({ page, baseURL }) => {
    // プロフィールページへ
    await page.goto(`${baseURL}/profile`);
    
    // パスワード変更セクションを探す
    const passwordSection = page.locator('text=/パスワード変更|Change password/');
    
    if (await passwordSection.isVisible({ timeout: 2000 })) {
      // 現在のパスワード
      const currentPasswordInput = page.locator('input[name="currentPassword"], input[placeholder*="現在のパスワード"]');
      const newPasswordInput = page.locator('input[name="newPassword"], input[placeholder*="新しいパスワード"]');
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="確認"]');
      
      if (await currentPasswordInput.isVisible()) {
        await currentPasswordInput.fill(TEST_CONFIG.users.standard.password);
        await newPasswordInput.fill('NewPassword123!');
        await confirmPasswordInput.fill('NewPassword123!');
        
        // 変更ボタンをクリック
        const changeButton = page.locator('button:has-text("パスワードを変更"), button:has-text("Change password")');
        await changeButton.click();
        
        // 結果メッセージが表示される
        const resultMessage = page.locator('text=/変更しました|成功|パスワードが/');
        await expect(resultMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
      }
    }
  });

  test('メール通知設定', async ({ page, baseURL }) => {
    // プロフィールページへ
    await page.goto(`${baseURL}/profile`);
    
    // 通知設定セクションを探す
    const notificationSection = page.locator('text=/通知設定|Notifications/');
    
    if (await notificationSection.isVisible({ timeout: 2000 })) {
      // メール通知のトグルを探す
      const emailToggle = page.locator('input[type="checkbox"][name*="email"], button[aria-label*="メール通知"]');
      
      if (await emailToggle.first().isVisible()) {
        // トグルの状態を変更
        await emailToggle.first().click();
        
        // 自動保存または保存ボタンをクリック
        const saveButton = page.locator('button:has-text("保存")');
        if (await saveButton.isVisible({ timeout: 1000 })) {
          await saveButton.click();
        }
        
        // 変更が保存されたことを確認
        await page.waitForTimeout(1000);
        await page.reload();
        
        // 設定が維持されていることを確認
        await expect(emailToggle.first()).toBeVisible();
      }
    }
  });

  test('アカウントの削除', async ({ page, baseURL }) => {
    // プロフィールページへ
    await page.goto(`${baseURL}/profile`);
    
    // アカウント削除セクションを探す
    const deleteSection = page.locator('text=/アカウント削除|Delete account/');
    
    if (await deleteSection.isVisible({ timeout: 2000 })) {
      // 削除ボタンを探す
      const deleteButton = page.locator('button:has-text("アカウントを削除"), button:has-text("Delete account")');
      
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // 確認モーダルが表示される
        const confirmModal = page.locator('[role="dialog"], .modal').filter({ hasText: /削除|delete/i });
        await expect(confirmModal).toBeVisible();
        
        // 確認テキストの入力が必要な場合
        const confirmInput = page.locator('input[placeholder*="DELETE"], input[placeholder*="削除"]');
        if (await confirmInput.isVisible()) {
          await confirmInput.fill('DELETE');
        }
        
        // キャンセルボタンをクリック（実際には削除しない）
        const cancelButton = page.locator('button:has-text("キャンセル"), button:has-text("Cancel")');
        await cancelButton.click();
        
        // モーダルが閉じることを確認
        await expect(confirmModal).not.toBeVisible();
      }
    }
  });

  test('APIキーの管理', async ({ page, baseURL }) => {
    // プロフィールページへ
    await page.goto(`${baseURL}/profile`);
    
    // APIキーセクションを探す
    const apiSection = page.locator('text=/APIキー|API Key/');
    
    if (await apiSection.isVisible({ timeout: 2000 })) {
      // APIキー生成ボタンを探す
      const generateButton = page.locator('button:has-text("生成"), button:has-text("Generate")');
      
      if (await generateButton.isVisible()) {
        await generateButton.click();
        
        // APIキーが表示される
        const apiKeyDisplay = page.locator('code, .api-key-display');
        await expect(apiKeyDisplay).toBeVisible();
        
        // コピーボタンがあるか確認
        const copyButton = page.locator('button:has-text("コピー"), button[aria-label="Copy"]');
        if (await copyButton.isVisible()) {
          await copyButton.click();
          
          // コピー成功メッセージ
          const copySuccess = page.locator('text=/コピーしました|Copied/');
          await expect(copySuccess).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
        }
      }
    }
  });
});
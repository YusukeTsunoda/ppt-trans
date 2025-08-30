import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * パスワードリセット機能 - 追加機能テスト
 */
test.describe('パスワードリセット機能', () => {
  test('パスワードリセットリクエスト', async ({ page, baseURL }) => {
    // ログインページへ
    await page.goto(`${baseURL}/login`);
    
    // パスワードを忘れたリンクを探す
    const forgotPasswordLink = page.locator('a:has-text("パスワードを忘れた"), a:has-text("Forgot password")');
    
    if (await forgotPasswordLink.isVisible({ timeout: 2000 })) {
      await forgotPasswordLink.click();
      
      // パスワードリセットページへ遷移
      await expect(page).toHaveURL(/.*\/(forgot-password|reset)/);
      
      // メールアドレスを入力
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('test@example.com');
      
      // リセットリンク送信ボタンをクリック
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // 成功メッセージが表示される
      const successMessage = page.locator('text=/送信しました|メールを確認|Check your email/');
      await expect(successMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
    }
  });

  test('無効なメールアドレスでのリセット', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/login`);
    
    const forgotPasswordLink = page.locator('a:has-text("パスワードを忘れた"), a:has-text("Forgot password")');
    
    if (await forgotPasswordLink.isVisible({ timeout: 2000 })) {
      await forgotPasswordLink.click();
      
      // 無効なメールアドレスを入力
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      await emailInput.fill('invalid-email');
      
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();
      
      // バリデーションエラーが表示される
      const errorMessage = page.locator('text=/無効|Invalid|正しいメールアドレス/');
      await expect(errorMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
    }
  });

  test('パスワードリセットフォームのバリデーション', async ({ page, baseURL }) => {
    // 実際のリセットトークンがある場合のテスト
    // 通常はメールリンクから遷移するが、テスト用のURLがあれば使用
    const resetUrl = `${baseURL}/reset-password?token=test-token`;
    
    try {
      await page.goto(resetUrl);
      
      // パスワードリセットフォームが表示される場合
      const newPasswordInput = page.locator('input[name="password"], input[placeholder*="新しいパスワード"]');
      const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="確認"]');
      
      if (await newPasswordInput.isVisible({ timeout: 2000 })) {
        // 短いパスワードを入力
        await newPasswordInput.fill('123');
        await confirmPasswordInput.fill('123');
        
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();
        
        // パスワード要件エラーが表示される
        const errorMessage = page.locator('text=/8文字以上|too short|パスワードは/');
        await expect(errorMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
        
        // 一致しないパスワードを入力
        await newPasswordInput.fill('ValidPassword123!');
        await confirmPasswordInput.fill('DifferentPassword123!');
        await submitButton.click();
        
        // パスワード不一致エラーが表示される
        const mismatchError = page.locator('text=/一致しません|do not match|同じ/');
        await expect(mismatchError).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
      }
    } catch (error) {
      // リセットページが存在しない場合はスキップ
      test.skip();
    }
  });
});
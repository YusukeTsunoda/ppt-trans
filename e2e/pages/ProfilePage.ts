import { Page, Locator } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * プロフィールページのPage Object
 */
export class ProfilePage {
  readonly page: Page;
  readonly profileLink: Locator;
  readonly nameInput: Locator;
  readonly emailDisplay: Locator;
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly saveButton: Locator;
  readonly changePasswordButton: Locator;
  readonly deleteAccountButton: Locator;
  readonly confirmModal: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly emailNotificationToggle: Locator;
  readonly apiKeySection: Locator;
  readonly generateApiKeyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // ナビゲーション
    this.profileLink = page.locator('a[href*="/profile"], button:has-text("プロフィール")');
    
    // プロフィール編集
    this.nameInput = page.locator('input[name="name"], input[placeholder*="名前"]');
    this.emailDisplay = page.locator('text=/test@example.com/');
    
    // パスワード変更
    this.currentPasswordInput = page.locator('input[name="currentPassword"], input[placeholder*="現在のパスワード"]');
    this.newPasswordInput = page.locator('input[name="newPassword"], input[placeholder*="新しいパスワード"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"], input[placeholder*="確認"]');
    this.changePasswordButton = page.locator('button:has-text("パスワードを変更"), button:has-text("Change password")');
    
    // アクションボタン
    this.saveButton = page.locator('button:has-text("保存"), button:has-text("更新")');
    this.deleteAccountButton = page.locator('button:has-text("アカウントを削除"), button:has-text("Delete account")');
    
    // モーダル・メッセージ
    this.confirmModal = page.locator('[role="dialog"], .modal');
    this.successMessage = page.locator('text=/更新しました|保存しました|Updated successfully/');
    this.errorMessage = page.locator('.bg-red-50, [role="alert"]');
    
    // 設定
    this.emailNotificationToggle = page.locator('input[type="checkbox"][name*="email"], button[aria-label*="メール通知"]');
    
    // APIキー
    this.apiKeySection = page.locator('text=/APIキー|API Key/');
    this.generateApiKeyButton = page.locator('button:has-text("生成"), button:has-text("Generate")');
  }

  /**
   * プロフィールページへ遷移
   */
  async navigate() {
    await this.page.goto('/profile');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * ダッシュボードからプロフィールページへ遷移
   */
  async navigateFromDashboard() {
    if (await this.profileLink.first().isVisible({ timeout: 2000 })) {
      await this.profileLink.first().click();
      await this.page.waitForURL(/.*\/profile/, { timeout: TEST_CONFIG.timeouts.navigation });
    }
  }

  /**
   * 名前を更新
   */
  async updateName(newName: string) {
    await this.nameInput.clear();
    await this.nameInput.fill(newName);
    await this.saveButton.click();
    await this.waitForSuccess();
  }

  /**
   * パスワードを変更
   */
  async changePassword(currentPassword: string, newPassword: string) {
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.changePasswordButton.click();
    await this.waitForSuccess();
  }

  /**
   * メール通知設定を切り替え
   */
  async toggleEmailNotifications() {
    if (await this.emailNotificationToggle.first().isVisible()) {
      await this.emailNotificationToggle.first().click();
      
      // 自動保存でない場合は保存ボタンをクリック
      if (await this.saveButton.isVisible({ timeout: 1000 })) {
        await this.saveButton.click();
        await this.waitForSuccess();
      }
    }
  }

  /**
   * APIキーを生成
   */
  async generateApiKey() {
    if (await this.generateApiKeyButton.isVisible()) {
      await this.generateApiKeyButton.click();
      
      // APIキーが表示されるのを待つ
      const apiKeyDisplay = this.page.locator('code, .api-key-display');
      await apiKeyDisplay.waitFor({ state: 'visible', timeout: TEST_CONFIG.timeouts.standard });
      
      return await apiKeyDisplay.textContent();
    }
    return null;
  }

  /**
   * APIキーをコピー
   */
  async copyApiKey() {
    const copyButton = this.page.locator('button:has-text("コピー"), button[aria-label="Copy"]');
    if (await copyButton.isVisible()) {
      await copyButton.click();
      
      // コピー成功メッセージを待つ
      const copySuccess = this.page.locator('text=/コピーしました|Copied/');
      await copySuccess.waitFor({ state: 'visible', timeout: TEST_CONFIG.timeouts.quick });
      return true;
    }
    return false;
  }

  /**
   * アカウント削除ダイアログを開く
   */
  async openDeleteAccountDialog() {
    if (await this.deleteAccountButton.isVisible()) {
      await this.deleteAccountButton.click();
      await this.confirmModal.waitFor({ state: 'visible', timeout: TEST_CONFIG.timeouts.standard });
    }
  }

  /**
   * アカウント削除をキャンセル
   */
  async cancelDeleteAccount() {
    const cancelButton = this.page.locator('button:has-text("キャンセル"), button:has-text("Cancel")');
    await cancelButton.click();
    await this.confirmModal.waitFor({ state: 'hidden', timeout: TEST_CONFIG.timeouts.standard });
  }

  /**
   * アカウント削除を確認（実際には削除しない）
   */
  async confirmDeleteAccount(confirmText: string = 'DELETE') {
    const confirmInput = this.page.locator('input[placeholder*="DELETE"], input[placeholder*="削除"]');
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(confirmText);
    }
    
    const confirmButton = this.page.locator('button:has-text("削除する"), button:has-text("Delete")');
    // 実際のテストでは削除しないようにする
    // await confirmButton.click();
  }

  /**
   * 成功メッセージを待つ
   */
  async waitForSuccess() {
    await this.successMessage.waitFor({ 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.standard 
    });
  }

  /**
   * エラーメッセージが表示されているか確認
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.first().isVisible({ timeout: 1000 });
  }

  /**
   * 現在の名前を取得
   */
  async getCurrentName(): Promise<string | null> {
    return await this.nameInput.inputValue();
  }

  /**
   * メール通知が有効か確認
   */
  async isEmailNotificationEnabled(): Promise<boolean> {
    if (await this.emailNotificationToggle.first().isVisible()) {
      return await this.emailNotificationToggle.first().isChecked();
    }
    return false;
  }
}
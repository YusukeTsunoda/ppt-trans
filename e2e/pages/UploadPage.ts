import { Page, Locator, expect } from '@playwright/test';

/**
 * アップロードページのPage Object
 * ページの要素と操作をカプセル化
 */
export class UploadPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly fileNameDisplay: Locator;
  readonly fileSizeDisplay: Locator;
  readonly helpText: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // 要素のロケーター定義
    this.fileInput = page.locator('input[type="file"]#file-input');
    this.uploadButton = page.locator('button[data-testid="upload-button"]');
    this.errorMessage = page.locator('[role="alert"], [data-testid="upload-error"]');
    this.successMessage = page.locator('[data-testid="upload-success"]');
    this.fileNameDisplay = page.locator('text=/選択されたファイル/').locator('..');
    this.fileSizeDisplay = page.locator('text=/サイズ:/').locator('..');
    this.helpText = page.locator('#file-help');
  }
  
  /**
   * ページへ遷移
   */
  async goto() {
    await this.page.goto('/upload');
    await this.page.waitForLoadState('networkidle');
  }
  
  /**
   * ファイルを選択
   */
  async selectFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    // ファイル情報が表示されるまで待つ
    await this.page.waitForTimeout(500);
  }
  
  /**
   * ファイル選択をクリア
   */
  async clearFileSelection() {
    await this.fileInput.setInputFiles([]);
  }
  
  /**
   * アップロードボタンをクリック
   */
  async clickUpload() {
    await this.uploadButton.click();
  }
  
  /**
   * アップロード成功を待つ
   */
  async waitForSuccess(timeout = 15000) {
    await Promise.race([
      this.page.waitForURL('**/dashboard', { timeout }),
      this.successMessage.waitFor({ state: 'visible', timeout })
    ]);
  }
  
  /**
   * エラーメッセージを取得
   */
  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * 成功メッセージを取得
   */
  async getSuccessMessage(): Promise<string | null> {
    try {
      await this.successMessage.waitFor({ state: 'visible', timeout: 5000 });
      return await this.successMessage.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * アップロードボタンが有効か確認
   */
  async isUploadButtonEnabled(): Promise<boolean> {
    return await this.uploadButton.isEnabled();
  }
  
  /**
   * アップロードボタンが無効か確認
   */
  async isUploadButtonDisabled(): Promise<boolean> {
    return await this.uploadButton.isDisabled();
  }
  
  /**
   * 選択されたファイル名を取得
   */
  async getSelectedFileName(): Promise<string | null> {
    try {
      const text = await this.fileNameDisplay.textContent();
      const match = text?.match(/選択されたファイル:\s*(.+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  /**
   * ファイルサイズを取得
   */
  async getFileSize(): Promise<string | null> {
    try {
      const text = await this.fileSizeDisplay.textContent();
      const match = text?.match(/サイズ:\s*(.+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  
  /**
   * 完全なアップロードフローを実行
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.selectFile(filePath);
    await this.clickUpload();
    await this.waitForSuccess();
  }
  
  /**
   * バリデーションエラーをトリガー
   */
  async triggerValidationError(invalidFilePath: string): Promise<string | null> {
    await this.selectFile(invalidFilePath);
    return await this.getErrorMessage();
  }
  
  /**
   * キーボードナビゲーションテスト
   */
  async testKeyboardNavigation(): Promise<boolean> {
    // ページ本体にフォーカス
    await this.page.locator('body').click({ position: { x: 0, y: 0 } });
    
    // Tabキーを押してファイル入力を探す
    for (let i = 0; i < 10; i++) {
      await this.page.keyboard.press('Tab');
      
      const focused = await this.page.evaluate(() => {
        const el = document.activeElement;
        return el?.tagName === 'INPUT' && el.getAttribute('type') === 'file';
      });
      
      if (focused) {
        // 次の要素（アップロードボタン）へ
        await this.page.keyboard.press('Tab');
        
        const buttonFocused = await this.page.evaluate(() => {
          const el = document.activeElement;
          return el?.tagName === 'BUTTON' && 
                 el?.getAttribute('data-testid') === 'upload-button';
        });
        
        return buttonFocused;
      }
    }
    
    return false;
  }
  
  /**
   * アクセシビリティ属性の検証
   */
  async verifyAccessibility(): Promise<{
    hasAriaLabel: boolean;
    hasAriaDescribedBy: boolean;
    hasAriaRequired: boolean;
    formHasLabel: boolean;
  }> {
    const fileInputAriaLabel = await this.fileInput.getAttribute('aria-label');
    const fileInputAriaDescribedBy = await this.fileInput.getAttribute('aria-describedby');
    const fileInputAriaRequired = await this.fileInput.getAttribute('aria-required');
    const formAriaLabel = await this.page.locator('form').getAttribute('aria-label');
    
    return {
      hasAriaLabel: !!fileInputAriaLabel,
      hasAriaDescribedBy: !!fileInputAriaDescribedBy,
      hasAriaRequired: fileInputAriaRequired === 'true',
      formHasLabel: !!formAriaLabel
    };
  }
}
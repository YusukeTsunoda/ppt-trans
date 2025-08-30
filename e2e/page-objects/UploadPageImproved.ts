/**
 * アップロードページオブジェクト（改善版）
 * ファイルアップロード機能の詳細なテストをサポート
 */

import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { testConfig } from '../config/test.config';
import { expectations } from '../fixtures/test-data';
import path from 'path';

export class UploadPageImproved extends BasePage {
  // セレクタを data-testid ベースに変更（変更に強い）
  private readonly selectors = {
    fileInput: '[data-testid="file-input"], input[type="file"]',
    uploadButton: '[data-testid="upload-button"], button:contains("アップロード")',
    cancelButton: '[data-testid="cancel-button"], button:contains("キャンセル")',
    fileInfo: '[data-testid="file-info"]',
    fileName: '[data-testid="file-name"]',
    fileSize: '[data-testid="file-size"]',
    progressBar: '[data-testid="progress-bar"], [role="progressbar"]',
    progressText: '[data-testid="progress-text"]',
    successMessage: '[data-testid="success-message"], .success-message',
    errorMessage: '[data-testid="error-message"], [role="alert"]',
    filePreview: '[data-testid="file-preview"]',
    dropZone: '[data-testid="drop-zone"], .drop-zone'
  };
  
  constructor(page: Page) {
    super(page);
  }
  
  /**
   * アップロードページへ遷移
   */
  async navigateToUploadPage(): Promise<void> {
    await this.navigate('/upload');
    await this.waitForPageReady();
  }
  
  /**
   * ページの準備完了を待つ
   */
  protected async waitForPageReady(): Promise<void> {
    await super.waitForPageReady();
    // ファイル入力要素が表示されるまで待つ
    await this.waitForElement(this.selectors.fileInput);
  }
  
  /**
   * ファイルを選択（実際のファイルパスを使用）
   */
  async selectFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(process.cwd(), filePath);
    
    const fileInput = await this.waitForElement(this.selectors.fileInput);
    await fileInput.setInputFiles(absolutePath);
    
    // ファイル情報が表示されるまで待つ
    await this.waitForElement(this.selectors.fileInfo);
  }
  
  /**
   * 複数ファイルを選択
   */
  async selectMultipleFiles(filePaths: string[]): Promise<void> {
    const absolutePaths = filePaths.map(fp => 
      path.isAbsolute(fp) ? fp : path.join(process.cwd(), fp)
    );
    
    const fileInput = await this.waitForElement(this.selectors.fileInput);
    await fileInput.setInputFiles(absolutePaths);
  }
  
  /**
   * ドラッグ＆ドロップでファイルを追加（シミュレーション）
   */
  async dragAndDropFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(process.cwd(), filePath);
    
    // ドロップゾーンを取得
    const dropZone = await this.waitForElement(this.selectors.dropZone);
    
    // ファイルドロップをシミュレート
    const dataTransfer = await this.page.evaluateHandle(() => new DataTransfer());
    
    // ファイルを作成してDataTransferに追加
    await this.page.evaluate(
      async ([path, dt]) => {
        const file = new File(['test content'], path.split('/').pop() || 'test.pptx', {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        });
        dt.items.add(file);
      },
      [absolutePath, dataTransfer]
    );
    
    // ドロップイベントを発火
    await dropZone.dispatchEvent('drop', { dataTransfer });
  }
  
  /**
   * 選択されたファイル名を取得
   */
  async getSelectedFileName(): Promise<string | null> {
    try {
      const fileNameElement = await this.waitForElement(this.selectors.fileName, 2000);
      return await fileNameElement.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * 選択されたファイルサイズを取得
   */
  async getSelectedFileSize(): Promise<string | null> {
    try {
      const fileSizeElement = await this.waitForElement(this.selectors.fileSize, 2000);
      return await fileSizeElement.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * アップロードボタンをクリック
   */
  async clickUploadButton(): Promise<void> {
    const uploadButton = await this.waitForElement(this.selectors.uploadButton);
    
    // ボタンが有効になるまで待つ
    await this.page.waitForFunction(
      (selector) => {
        const button = document.querySelector(selector) as HTMLButtonElement;
        return button && !button.disabled;
      },
      this.selectors.uploadButton,
      { timeout: testConfig.timeouts.action }
    );
    
    await uploadButton.click();
  }
  
  /**
   * アップロードをキャンセル
   */
  async clickCancelButton(): Promise<void> {
    const cancelButton = await this.waitForElement(this.selectors.cancelButton);
    await cancelButton.click();
  }
  
  /**
   * アップロードの進捗を監視
   */
  async monitorUploadProgress(): Promise<{
    startTime: number;
    endTime: number;
    duration: number;
    maxProgress: number;
    progressUpdates: number[];
  }> {
    const startTime = Date.now();
    const progressUpdates: number[] = [];
    let maxProgress = 0;
    
    // 進捗バーが表示されるまで待つ
    await this.waitForElement(this.selectors.progressBar, 5000);
    
    // 進捗を定期的にチェック
    const checkInterval = setInterval(async () => {
      try {
        const progressBar = this.page.locator(this.selectors.progressBar);
        const progressValue = await progressBar.getAttribute('aria-valuenow') 
          || await progressBar.getAttribute('value')
          || '0';
        
        const progress = parseInt(progressValue);
        progressUpdates.push(progress);
        maxProgress = Math.max(maxProgress, progress);
        
        // 100%に達したら監視を終了
        if (progress >= 100) {
          clearInterval(checkInterval);
        }
      } catch (error) {
        // 進捗バーが消えた場合も監視を終了
        clearInterval(checkInterval);
      }
    }, 500);
    
    // アップロード完了を待つ（成功またはエラー）
    await Promise.race([
      this.waitForElement(this.selectors.successMessage, testConfig.timeouts.upload),
      this.waitForElement(this.selectors.errorMessage, testConfig.timeouts.upload)
    ]);
    
    clearInterval(checkInterval);
    const endTime = Date.now();
    
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      maxProgress,
      progressUpdates
    };
  }
  
  /**
   * アップロード成功を待つ
   */
  async waitForUploadSuccess(timeout?: number): Promise<string> {
    const successMessage = await this.waitForElement(
      this.selectors.successMessage,
      timeout || testConfig.timeouts.upload
    );
    return await successMessage.textContent() || '';
  }
  
  /**
   * エラーメッセージを取得
   */
  async getUploadError(): Promise<string | null> {
    try {
      const errorMessage = await this.waitForElement(this.selectors.errorMessage, 2000);
      return await errorMessage.textContent();
    } catch {
      return null;
    }
  }
  
  /**
   * ファイルプレビューが表示されているか確認
   */
  async isFilePreviewVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.filePreview);
  }
  
  /**
   * アップロードボタンの状態を取得
   */
  async getUploadButtonState(): Promise<{
    isVisible: boolean;
    isEnabled: boolean;
    text: string;
  }> {
    const button = this.page.locator(this.selectors.uploadButton);
    
    return {
      isVisible: await button.isVisible(),
      isEnabled: await button.isEnabled(),
      text: await button.textContent() || ''
    };
  }
  
  /**
   * ファイル選択をクリア
   */
  async clearFileSelection(): Promise<void> {
    const fileInput = await this.waitForElement(this.selectors.fileInput);
    await fileInput.setInputFiles([]);
  }
  
  /**
   * ページの検証エラーを取得
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    // 各種バリデーションエラーをチェック
    const errorSelectors = [
      '[data-testid="file-type-error"]',
      '[data-testid="file-size-error"]',
      '[data-testid="file-count-error"]',
      '.validation-error',
      '.field-error'
    ];
    
    for (const selector of errorSelectors) {
      const elements = await this.page.locator(selector).all();
      for (const element of elements) {
        const text = await element.textContent();
        if (text) errors.push(text.trim());
      }
    }
    
    return errors;
  }
  
  /**
   * アップロード完了後のリダイレクトを待つ
   */
  async waitForPostUploadRedirect(expectedUrl: string | RegExp, timeout?: number): Promise<void> {
    await this.page.waitForURL(expectedUrl, {
      timeout: timeout || testConfig.timeouts.navigation
    });
  }
}
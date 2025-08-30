import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import * as path from 'path';

/**
 * UploadPage - ファイルアップロードページのPage Object
 */
export class UploadPage extends BasePage {
  // セレクタの定義
  private readonly selectors = {
    fileInput: 'input[type="file"]',
    uploadButton: 'button:has-text("アップロード"), button:has-text("Upload"), button[type="submit"]',
    dragDropZone: '.drop-zone, [data-testid="drop-zone"], .drag-drop-area',
    fileName: '.file-name, .selected-file, [data-testid="file-name"]',
    fileSize: '.file-size, [data-testid="file-size"]',
    progressBar: '.progress-bar, .upload-progress, [role="progressbar"]',
    progressText: '.progress-text, .progress-percentage',
    successMessage: '.success-message, .text-green-500, .alert-success',
    errorMessage: '.error-message, .text-red-500, .alert-danger',
    cancelButton: 'button:has-text("キャンセル"), button:has-text("Cancel")',
    clearButton: 'button:has-text("クリア"), button:has-text("Clear")',
    translationOptions: '.translation-options, [data-testid="translation-options"]',
    sourceLanguage: 'select[name="source_language"], #source-language',
    targetLanguage: 'select[name="target_language"], #target-language',
    uploadHistory: '.upload-history, [data-testid="upload-history"]',
    downloadButton: 'button:has-text("ダウンロード"), button:has-text("Download")',
    previewButton: 'button:has-text("プレビュー"), button:has-text("Preview")',
    loadingIndicator: '.loading, .spinner, [aria-busy="true"]'
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * アップロードページへナビゲート
   */
  async goto(): Promise<void> {
    await this.navigate('/upload');
    await this.waitForPageLoad();
  }

  /**
   * ファイルを選択
   */
  async selectFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    await this.page.setInputFiles(this.selectors.fileInput, absolutePath);
    await this.wait(500); // ファイル選択後の処理を待つ
  }

  /**
   * 複数ファイルを選択
   */
  async selectMultipleFiles(filePaths: string[]): Promise<void> {
    const absolutePaths = filePaths.map(fp => 
      path.isAbsolute(fp) ? fp : path.resolve(fp)
    );
    await this.page.setInputFiles(this.selectors.fileInput, absolutePaths);
    await this.wait(500);
  }

  /**
   * ファイルをドラッグ&ドロップ
   */
  async dragAndDropFile(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    // ドラッグ&ドロップのシミュレーション
    const buffer = await this.page.evaluateHandle(() => {
      const dt = new DataTransfer();
      return dt;
    });
    
    await this.page.dispatchEvent(this.selectors.dragDropZone, 'drop', { dataTransfer: buffer });
  }

  /**
   * アップロードボタンをクリック
   */
  async clickUploadButton(): Promise<void> {
    await this.click(this.selectors.uploadButton);
    await this.waitForLoadingToComplete();
  }

  /**
   * ファイルをアップロード（選択からアップロードまで）
   */
  async uploadFile(filePath: string): Promise<void> {
    await this.selectFile(filePath);
    await this.clickUploadButton();
  }

  /**
   * 選択されたファイル名を取得
   */
  async getSelectedFileName(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.fileName)) {
      return await this.getElementText(this.selectors.fileName);
    }
    return null;
  }

  /**
   * 選択されたファイルサイズを取得
   */
  async getSelectedFileSize(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.fileSize)) {
      return await this.getElementText(this.selectors.fileSize);
    }
    return null;
  }

  /**
   * アップロード進捗を取得
   */
  async getUploadProgress(): Promise<number> {
    if (await this.isElementVisible(this.selectors.progressBar)) {
      const progress = await this.getElementAttribute(this.selectors.progressBar, 'aria-valuenow');
      return progress ? parseInt(progress, 10) : 0;
    }
    
    if (await this.isElementVisible(this.selectors.progressText)) {
      const text = await this.getElementText(this.selectors.progressText);
      const match = text.match(/(\d+)%/);
      return match ? parseInt(match[1], 10) : 0;
    }
    
    return 0;
  }

  /**
   * アップロードが完了するまで待つ
   */
  async waitForUploadComplete(timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const progress = await this.getUploadProgress();
      if (progress >= 100) {
        break;
      }
      
      if (await this.isElementVisible(this.selectors.successMessage)) {
        break;
      }
      
      if (await this.isElementVisible(this.selectors.errorMessage)) {
        throw new Error('Upload failed: ' + await this.getElementText(this.selectors.errorMessage));
      }
      
      await this.wait(500);
    }
    
    await this.waitForLoadingToComplete();
  }

  /**
   * アップロードをキャンセル
   */
  async cancelUpload(): Promise<void> {
    if (await this.isElementVisible(this.selectors.cancelButton)) {
      await this.click(this.selectors.cancelButton);
    }
  }

  /**
   * ファイル選択をクリア
   */
  async clearFileSelection(): Promise<void> {
    if (await this.isElementVisible(this.selectors.clearButton)) {
      await this.click(this.selectors.clearButton);
    } else {
      await this.page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) input.value = '';
      }, this.selectors.fileInput);
    }
  }

  /**
   * ソース言語を選択
   */
  async selectSourceLanguage(language: string): Promise<void> {
    if (await this.isElementVisible(this.selectors.sourceLanguage)) {
      await this.selectOption(this.selectors.sourceLanguage, language);
    }
  }

  /**
   * ターゲット言語を選択
   */
  async selectTargetLanguage(language: string): Promise<void> {
    if (await this.isElementVisible(this.selectors.targetLanguage)) {
      await this.selectOption(this.selectors.targetLanguage, language);
    }
  }

  /**
   * 翻訳オプションを設定
   */
  async setTranslationOptions(options: {
    sourceLanguage?: string;
    targetLanguage?: string;
  }): Promise<void> {
    if (options.sourceLanguage) {
      await this.selectSourceLanguage(options.sourceLanguage);
    }
    
    if (options.targetLanguage) {
      await this.selectTargetLanguage(options.targetLanguage);
    }
  }

  /**
   * アップロード成功メッセージを取得
   */
  async getSuccessMessage(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.successMessage)) {
      return await this.getElementText(this.selectors.successMessage);
    }
    return null;
  }

  /**
   * アップロードエラーメッセージを取得
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.errorMessage)) {
      return await this.getElementText(this.selectors.errorMessage);
    }
    return null;
  }

  /**
   * アップロードが成功したか確認
   */
  async isUploadSuccessful(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.successMessage);
  }

  /**
   * アップロードが失敗したか確認
   */
  async isUploadFailed(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.errorMessage);
  }

  /**
   * ダウンロードボタンをクリック
   */
  async clickDownloadButton(): Promise<void> {
    if (await this.isElementVisible(this.selectors.downloadButton)) {
      // ダウンロードを待つ
      const downloadPromise = this.page.waitForEvent('download');
      await this.click(this.selectors.downloadButton);
      const download = await downloadPromise;
      
      // ダウンロードが完了するまで待つ
      await download.path();
    }
  }

  /**
   * プレビューボタンをクリック
   */
  async clickPreviewButton(): Promise<void> {
    if (await this.isElementVisible(this.selectors.previewButton)) {
      await this.click(this.selectors.previewButton);
      await this.waitForLoadingToComplete();
    }
  }

  /**
   * アップロード履歴を取得
   */
  async getUploadHistory(): Promise<string[]> {
    const history: string[] = [];
    
    if (await this.isElementVisible(this.selectors.uploadHistory)) {
      const historyItems = this.page.locator(`${this.selectors.uploadHistory} .history-item`);
      const count = await historyItems.count();
      
      for (let i = 0; i < count; i++) {
        const text = await historyItems.nth(i).textContent();
        if (text) history.push(text);
      }
    }
    
    return history;
  }

  /**
   * ファイルアップロードフォームが表示されているか
   */
  async isUploadFormDisplayed(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.fileInput) && 
           await this.isElementEnabled(this.selectors.uploadButton);
  }

  /**
   * ドラッグ&ドロップゾーンが表示されているか
   */
  async isDragDropZoneVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.dragDropZone);
  }

  /**
   * アップロードの詳細情報を取得
   */
  async getUploadDetails(): Promise<{
    fileName: string | null;
    fileSize: string | null;
    progress: number;
    status: 'idle' | 'uploading' | 'success' | 'error';
  }> {
    const fileName = await this.getSelectedFileName();
    const fileSize = await this.getSelectedFileSize();
    const progress = await this.getUploadProgress();
    
    let status: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
    
    if (await this.isUploadSuccessful()) {
      status = 'success';
    } else if (await this.isUploadFailed()) {
      status = 'error';
    } else if (progress > 0 && progress < 100) {
      status = 'uploading';
    }
    
    return { fileName, fileSize, progress, status };
  }
}
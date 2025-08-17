import { Page, Locator } from '@playwright/test';

/**
 * ダッシュボードページのPage Object
 */
export class DashboardPage {
  readonly page: Page;
  readonly fileList: Locator;
  readonly fileItems: Locator;
  readonly uploadButton: Locator;
  readonly refreshButton: Locator;
  readonly emptyState: Locator;
  
  constructor(page: Page) {
    this.page = page;
    
    // 要素のロケーター定義
    this.fileList = page.locator('[data-testid="file-list"], .file-list');
    this.fileItems = page.locator('[data-testid="file-item"], tr:has(td)');
    this.uploadButton = page.locator('a:has-text("新規アップロード"), a:has-text("最初のファイルをアップロード")');
    this.refreshButton = page.locator('button[title="更新"]');
    this.emptyState = page.locator('[data-testid="empty-file-list"], text=/まだファイルがアップロードされていません/');
  }
  
  /**
   * ページへ遷移
   */
  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }
  
  /**
   * ファイルリストを更新
   */
  async refresh() {
    await this.refreshButton.click();
    await this.page.waitForLoadState('networkidle');
  }
  
  /**
   * ファイル一覧を取得
   */
  async getFileList(): Promise<string[]> {
    await this.page.waitForTimeout(1000); // データ読み込みを待つ
    
    if (await this.emptyState.isVisible()) {
      return [];
    }
    
    const files: string[] = [];
    const count = await this.fileItems.count();
    
    for (let i = 0; i < count; i++) {
      const text = await this.fileItems.nth(i).textContent();
      const fileName = text?.match(/\.pptx?/i) ? text.split(/\s+/)[0] : null;
      if (fileName) {
        files.push(fileName);
      }
    }
    
    return files;
  }
  
  /**
   * 特定のファイルが存在するか確認
   */
  async hasFile(fileName: string): Promise<boolean> {
    const files = await this.getFileList();
    return files.some(file => file.includes(fileName));
  }
  
  /**
   * ファイル数を取得
   */
  async getFileCount(): Promise<number> {
    if (await this.emptyState.isVisible()) {
      return 0;
    }
    return await this.fileItems.count();
  }
  
  /**
   * ファイルのアクションボタンを取得
   */
  async getFileActions(fileName: string): Promise<{
    preview: Locator;
    translate: Locator;
    download: Locator;
    delete: Locator;
  }> {
    const fileRow = this.page.locator(`tr:has-text("${fileName}")`);
    
    return {
      preview: fileRow.locator('button:has-text("プレビュー")'),
      translate: fileRow.locator('button:has-text("翻訳")'),
      download: fileRow.locator('button:has-text("ダウンロード")'),
      delete: fileRow.locator('button:has-text("削除")')
    };
  }
  
  /**
   * ファイルをプレビュー
   */
  async previewFile(fileName: string) {
    const actions = await this.getFileActions(fileName);
    await actions.preview.click();
    await this.page.waitForURL('**/preview/**');
  }
  
  /**
   * ファイルを翻訳
   */
  async translateFile(fileName: string) {
    const actions = await this.getFileActions(fileName);
    await actions.translate.click();
  }
  
  /**
   * ファイルを削除
   */
  async deleteFile(fileName: string) {
    const actions = await this.getFileActions(fileName);
    await actions.delete.click();
    
    // 確認ダイアログが表示される場合の処理
    const confirmButton = this.page.locator('button:has-text("確認"), button:has-text("削除")');
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }
    
    // 削除完了を待つ
    await this.page.waitForTimeout(1000);
  }
  
  /**
   * 新規アップロードページへ遷移
   */
  async navigateToUpload() {
    await this.uploadButton.first().click();
    await this.page.waitForURL('**/upload');
  }
  
  /**
   * ファイルが表示されるまで待つ
   */
  async waitForFile(fileName: string, timeout = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.hasFile(fileName)) {
        return true;
      }
      await this.page.waitForTimeout(500);
      await this.refresh();
    }
    
    return false;
  }
  
  /**
   * すべてのファイルを削除（クリーンアップ用）
   */
  async deleteAllFiles() {
    const files = await this.getFileList();
    
    for (const file of files) {
      try {
        await this.deleteFile(file);
      } catch (error) {
        console.error(`Failed to delete file: ${file}`, error);
      }
    }
  }
}
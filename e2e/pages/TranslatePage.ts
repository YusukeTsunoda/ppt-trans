import { Page, Locator } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * 翻訳プレビューページのPage Object
 */
export class TranslatePage {
  readonly page: Page;
  readonly languageSelect: Locator;
  readonly translateCurrentButton: Locator;
  readonly translateAllButton: Locator;
  readonly downloadButton: Locator;
  readonly slideText: Locator;
  readonly translatedText: Locator;
  readonly nextSlideButton: Locator;
  readonly prevSlideButton: Locator;
  readonly progressBar: Locator;
  readonly successMessage: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // 基本要素
    this.languageSelect = page.locator('select').first();
    this.translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
    this.translateAllButton = page.locator('button:has-text("すべて翻訳")');
    this.downloadButton = page.locator('button:has-text("ダウンロード"), button:has-text("翻訳済みをダウンロード")');
    
    // テキスト要素
    this.slideText = page.locator('[data-testid="slide-text"]');
    this.translatedText = page.locator('[data-testid="translated-text"]');
    
    // ナビゲーション
    this.nextSlideButton = page.locator('button[aria-label="次のスライド"], button:has-text("次へ")');
    this.prevSlideButton = page.locator('button[aria-label="前のスライド"], button:has-text("前へ")');
    
    // フィードバック要素
    this.progressBar = page.getByRole('progressbar');
    this.successMessage = page.locator('text=/翻訳が完了しました|Translation completed/');
    this.errorMessage = page.locator('.bg-red-50, [role="alert"]');
  }

  /**
   * プレビューページへ遷移
   */
  async navigate(fileId?: string) {
    if (fileId) {
      await this.page.goto(`/preview/${fileId}`);
    } else {
      // ダッシュボードから最初のファイルのプレビューへ
      const previewButton = this.page.locator('a[href*="/preview/"]').first();
      await previewButton.click();
    }
    await this.page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
  }

  /**
   * テキスト抽出の完了を待つ
   */
  async waitForTextExtraction() {
    await this.slideText.first().waitFor({ 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
  }

  /**
   * 言語を選択
   */
  async selectLanguage(language: string) {
    await this.languageSelect.selectOption(language);
  }

  /**
   * 現在のスライドを翻訳
   */
  async translateCurrentSlide(language: string = 'en') {
    await this.selectLanguage(language);
    await this.translateCurrentButton.click();
    await this.waitForTranslation();
  }

  /**
   * すべてのスライドを翻訳
   */
  async translateAllSlides(language: string = 'en') {
    await this.selectLanguage(language);
    await this.translateAllButton.click();
    await this.waitForBatchTranslation();
  }

  /**
   * 翻訳完了を待つ
   */
  async waitForTranslation() {
    await this.translatedText.first().waitFor({ 
      state: 'visible',
      timeout: TEST_CONFIG.timeouts.upload 
    });
  }

  /**
   * バッチ翻訳完了を待つ
   */
  async waitForBatchTranslation() {
    await this.successMessage.waitFor({ 
      state: 'visible',
      timeout: 60000 
    });
  }

  /**
   * 翻訳済みファイルをダウンロード
   */
  async downloadTranslatedFile() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadButton.first().click();
    return await downloadPromise;
  }

  /**
   * 次のスライドへ移動
   */
  async goToNextSlide() {
    if (await this.nextSlideButton.isEnabled()) {
      await this.nextSlideButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 前のスライドへ移動
   */
  async goToPrevSlide() {
    if (await this.prevSlideButton.isEnabled()) {
      await this.prevSlideButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 翻訳されたテキストを取得
   */
  async getTranslatedText(index: number = 0): Promise<string | null> {
    return await this.translatedText.nth(index).textContent();
  }

  /**
   * エラーメッセージが表示されているか確認
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.first().isVisible({ timeout: 1000 });
  }

  /**
   * 現在のスライド番号を取得
   */
  async getCurrentSlideNumber(): Promise<number> {
    const slideNumberText = await this.page.locator('text=/\\d+\\s*\\/\\s*\\d+/').textContent();
    if (slideNumberText) {
      const match = slideNumberText.match(/(\d+)/);
      return match ? parseInt(match[1]) : 1;
    }
    return 1;
  }
}
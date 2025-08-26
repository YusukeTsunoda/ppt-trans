/**
 * E2Eテスト統合設定
 * 既存のTEST_CONFIGと新規TestConfigを統合
 */

import { Page } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config';
import { WaitUtils } from '../utils/wait-utils';

// セレクタ定義
const selectors = {
  auth: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    confirmPasswordInput: 'input[name="confirmPassword"]',
    submitButton: 'button[type="submit"]',
    logoutButton: '[data-testid="logout-button"]',
    errorMessage: '.text-red-700, .text-red-400, [role="alert"]',
  },
  dashboard: {
    uploadLink: '[data-testid="new-upload-link"]',
    uploadButton: '[data-testid="new-upload-button"]', // モーダルトリガーボタン
    fileList: '[data-testid="file-list"]',
    emptyFileList: '[data-testid="empty-file-list"]',
    uploadedFilesTitle: '[data-testid="uploaded-files-title"]',
    profileLink: 'a[href="/profile"]',
    adminLink: 'a[href="/admin"]',
  },
  upload: {
    fileInput: 'input[type="file"]',
    uploadButton: 'button:has-text("アップロード")',
    progressBar: '[data-testid="upload-progress"]',
    successMessage: '[data-testid="upload-success"]',
    errorMessage: '[data-testid="upload-error"]',
  },
  translation: {
    languageSelect: 'select[data-testid="target-language"]',
    translateButton: 'button:has-text("翻訳")',
    translatedText: '[data-testid="translated-text"]',
    downloadButton: 'button:has-text("ダウンロード")',
  },
  preview: {
    slideText: '[data-testid="slide-text"]',
    slideImage: '[data-testid="slide-image"]',
    prevButton: '[data-testid="prev-slide"]',
    nextButton: '[data-testid="next-slide"]',
    slideCounter: '[data-testid="slide-counter"]',
  }
};

// URL定義
const urls = {
  home: '/',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  upload: '/upload',
  profile: '/profile',
  admin: '/admin',
  preview: (id: string) => `/preview/${id}`,
};

// テストデータ
const testData = {
  validPptx: 'e2e/fixtures/test-presentation.pptx',
  largePptx: 'e2e/fixtures/large-presentation.pptx',
  corruptedPptx: 'e2e/fixtures/corrupted.pptx',
  invalidFile: 'e2e/fixtures/invalid-file.txt',
  testImage: 'e2e/fixtures/test-avatar.png',
};

/**
 * 統合設定クラス
 * 既存と新規の設定を統合し、ヘルパーメソッドを提供
 */
export class Config {
  // 既存の設定を継承
  static readonly auth = TEST_CONFIG.auth;
  static readonly timeouts = TEST_CONFIG.timeouts;
  static readonly errorMessages = TEST_CONFIG.errorMessages;
  static readonly supabase = TEST_CONFIG.supabase;
  
  // 新しい設定を追加
  static readonly selectors = selectors;
  static readonly urls = urls;
  static readonly testData = testData;
  
  /**
   * 基本的なログイン処理
   */
  static async login(page: Page, email?: string, password?: string) {
    const loginEmail = email || this.auth.email;
    const loginPassword = password || this.auth.password;
    
    await page.goto(this.urls.login);
    await page.fill(this.selectors.auth.emailInput, loginEmail);
    await page.fill(this.selectors.auth.passwordInput, loginPassword);
    await page.click(this.selectors.auth.submitButton);
    
    // ダッシュボードへの遷移を待つ
    await WaitUtils.waitForPageTransition(page, /.*\/dashboard/, {
      timeout: this.timeouts.navigation
    });
    
    // 認証状態の確立を待つ
    await WaitUtils.waitForAuthentication(page);
  }
  
  /**
   * 認証状態のセットアップ
   */
  static async setupAuth(page: Page) {
    await this.login(page);
    
    // 認証状態が完全に確立されるまで待機
    await WaitUtils.waitForAuthentication(page);
  }
  
  /**
   * 安全なページ遷移
   * リトライと認証確認付き
   */
  static async safeNavigate(page: Page, url: string) {
    const maxRetries = 3;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto(url);
        await WaitUtils.waitForAuthentication(page);
        
        // 認証が必要なページでログインページにリダイレクトされた場合
        if (page.url().includes('/login') && !url.includes('/login')) {
          await this.login(page);
          await page.goto(url);
        }
        
        return;
      } catch (error) {
        console.log(`Navigation retry ${i + 1}/${maxRetries} for ${url}`);
        if (i === maxRetries - 1) throw error;
        
        // リトライ前に再認証
        await this.login(page);
      }
    }
  }
  
  /**
   * クリックしてページ遷移を待つ
   */
  static async clickAndNavigate(
    page: Page, 
    selector: string, 
    expectedUrl?: string | RegExp
  ) {
    await page.click(selector);
    
    if (expectedUrl) {
      await WaitUtils.waitForPageTransition(page, expectedUrl);
    } else {
      await page.waitForLoadState('networkidle');
    }
    
    await WaitUtils.waitForAuthentication(page);
  }
  
  /**
   * ログアウト処理
   */
  static async logout(page: Page) {
    // ログアウトボタンが存在する場合のみクリック
    const logoutButton = page.locator(this.selectors.auth.logoutButton);
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL(/.*\/login/, {
        timeout: this.timeouts.navigation
      });
    }
  }
  
  /**
   * ファイルアップロード処理（モーダル対応）
   */
  static async uploadFile(page: Page, filePath: string) {
    // ダッシュボードにいることを確認
    if (!page.url().includes('/dashboard')) {
      await this.safeNavigate(page, this.urls.dashboard);
    }
    
    // アップロードボタンをクリックしてモーダルを開く
    const uploadButton = page.locator(this.selectors.dashboard.uploadButton);
    if (await uploadButton.isVisible({ timeout: 5000 })) {
      await uploadButton.click();
    } else {
      // 代替：リンクを使用
      const uploadLink = page.locator(this.selectors.dashboard.uploadLink);
      if (await uploadLink.isVisible()) {
        await uploadLink.click();
      }
    }
    
    // モーダルまたはアップロードページが開くのを待つ
    await WaitUtils.waitForUploadReady(page);
    
    // ファイルを選択してアップロード
    const fileInput = page.locator(this.selectors.upload.fileInput);
    await fileInput.setInputFiles(filePath);
    
    // アップロードボタンをクリック
    const uploadSubmitButton = page.locator(this.selectors.upload.uploadButton);
    if (await uploadSubmitButton.isEnabled()) {
      await uploadSubmitButton.click();
    }
    
    // アップロード完了を待つ（ダッシュボードへの戻りまたは成功メッセージ）
    await Promise.race([
      WaitUtils.waitForPageTransition(page, /.*\/dashboard/),
      page.waitForSelector(this.selectors.upload.successMessage, { timeout: 30000 })
    ]).catch(() => {});
  }
  
  /**
   * エラーメッセージの取得
   */
  static async getErrorMessage(page: Page): Promise<string | null> {
    const errorElement = page.locator(this.selectors.auth.errorMessage).first();
    if (await errorElement.isVisible()) {
      return await errorElement.textContent();
    }
    return null;
  }
  
  /**
   * 要素が表示されるまで待機
   */
  static async waitForElement(page: Page, selector: string, timeout?: number) {
    await page.waitForSelector(selector, {
      state: 'visible',
      timeout: timeout || this.timeouts.element
    });
  }
  
  /**
   * テスト用ユーザーの生成
   */
  static generateTestUser() {
    const timestamp = Date.now();
    return {
      email: `test-${timestamp}@example.com`,
      password: `Test${timestamp}!@#`,
      name: `TestUser${timestamp}`
    };
  }
}
import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DashboardPage - ダッシュボードページのPage Object
 */
export class DashboardPage extends BasePage {
  // セレクタの定義
  private readonly selectors = {
    welcomeMessage: 'text=/ようこそ|Welcome/',
    userEmail: '.user-email, [data-testid="user-email"]',
    logoutButton: 'button:has-text("ログアウト"), button:has-text("Logout")',
    uploadButton: 'button:has-text("アップロード"), button:has-text("Upload"), a[href*="/upload"]',
    filesLink: 'a:has-text("ファイル"), a:has-text("Files"), a[href*="/files"]',
    profileLink: 'a:has-text("プロフィール"), a:has-text("Profile"), a[href*="/profile"]',
    settingsLink: 'a:has-text("設定"), a:has-text("Settings"), a[href*="/settings"]',
    recentFiles: '.recent-files, [data-testid="recent-files"]',
    fileItem: '.file-item, [data-testid="file-item"]',
    statsCard: '.stats-card, [data-testid="stats-card"]',
    notificationBell: '.notification-bell, [aria-label*="notification"]',
    searchInput: 'input[type="search"], input[placeholder*="検索"], input[placeholder*="Search"]',
    sidebar: '.sidebar, nav[role="navigation"]',
    mainContent: 'main, .main-content',
    loadingIndicator: '.loading, .spinner, [aria-busy="true"]'
  };

  constructor(page: Page) {
    super(page);
  }

  /**
   * ダッシュボードページへナビゲート
   */
  async goto(): Promise<void> {
    await this.navigate('/dashboard');
    await this.waitForPageLoad();
  }

  /**
   * ダッシュボードが表示されているか確認
   */
  async isDashboardDisplayed(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.welcomeMessage);
  }

  /**
   * ユーザーのメールアドレスを取得
   */
  async getUserEmail(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.userEmail)) {
      return await this.getElementText(this.selectors.userEmail);
    }
    
    // welcomeメッセージから抽出を試みる
    const welcomeText = await this.getWelcomeMessage();
    const emailMatch = welcomeText?.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0] : null;
  }

  /**
   * ウェルカムメッセージを取得
   */
  async getWelcomeMessage(): Promise<string | null> {
    if (await this.isElementVisible(this.selectors.welcomeMessage)) {
      return await this.getElementText(this.selectors.welcomeMessage);
    }
    return null;
  }

  /**
   * ログアウトボタンをクリック
   */
  async logout(): Promise<void> {
    await this.click(this.selectors.logoutButton);
    await this.waitForURL('**/login', 10000);
  }

  /**
   * アップロードページへ移動
   */
  async navigateToUpload(): Promise<void> {
    await this.click(this.selectors.uploadButton);
    await this.waitForURL('**/upload');
  }

  /**
   * ファイル一覧ページへ移動
   */
  async navigateToFiles(): Promise<void> {
    await this.click(this.selectors.filesLink);
    await this.waitForURL('**/files');
  }

  /**
   * プロフィールページへ移動
   */
  async navigateToProfile(): Promise<void> {
    await this.click(this.selectors.profileLink);
    await this.waitForURL('**/profile');
  }

  /**
   * 設定ページへ移動
   */
  async navigateToSettings(): Promise<void> {
    if (await this.isElementVisible(this.selectors.settingsLink)) {
      await this.click(this.selectors.settingsLink);
      await this.waitForURL('**/settings');
    }
  }

  /**
   * 最近のファイル一覧を取得
   */
  async getRecentFiles(): Promise<string[]> {
    const files: string[] = [];
    
    if (await this.isElementVisible(this.selectors.recentFiles)) {
      const fileElements = this.page.locator(this.selectors.fileItem);
      const count = await fileElements.count();
      
      for (let i = 0; i < count; i++) {
        const text = await fileElements.nth(i).textContent();
        if (text) files.push(text);
      }
    }
    
    return files;
  }

  /**
   * 統計情報を取得
   */
  async getStatistics(): Promise<Record<string, string>> {
    const stats: Record<string, string> = {};
    
    if (await this.isElementVisible(this.selectors.statsCard)) {
      const statsElements = this.page.locator(this.selectors.statsCard);
      const count = await statsElements.count();
      
      for (let i = 0; i < count; i++) {
        const element = statsElements.nth(i);
        const label = await element.locator('.label, .stats-label').textContent();
        const value = await element.locator('.value, .stats-value').textContent();
        
        if (label && value) {
          stats[label.trim()] = value.trim();
        }
      }
    }
    
    return stats;
  }

  /**
   * 検索を実行
   */
  async search(query: string): Promise<void> {
    if (await this.isElementVisible(this.selectors.searchInput)) {
      await this.fill(this.selectors.searchInput, query);
      await this.pressKey('Enter');
      await this.waitForLoadingToComplete();
    }
  }

  /**
   * 通知があるか確認
   */
  async hasNotifications(): Promise<boolean> {
    if (await this.isElementVisible(this.selectors.notificationBell)) {
      const badge = await this.page.locator(`${this.selectors.notificationBell} .badge, ${this.selectors.notificationBell} .notification-count`);
      return await badge.isVisible();
    }
    return false;
  }

  /**
   * 通知の数を取得
   */
  async getNotificationCount(): Promise<number> {
    if (await this.hasNotifications()) {
      const badge = await this.page.locator(`${this.selectors.notificationBell} .badge, ${this.selectors.notificationBell} .notification-count`);
      const text = await badge.textContent();
      return parseInt(text || '0', 10);
    }
    return 0;
  }

  /**
   * サイドバーが表示されているか
   */
  async isSidebarVisible(): Promise<boolean> {
    return await this.isElementVisible(this.selectors.sidebar);
  }

  /**
   * サイドバーを開く/閉じる
   */
  async toggleSidebar(): Promise<void> {
    const toggleButton = 'button[aria-label*="menu"], button[aria-label*="sidebar"], .hamburger-menu';
    if (await this.isElementVisible(toggleButton)) {
      await this.click(toggleButton);
      await this.wait(300); // アニメーション待機
    }
  }

  /**
   * ダッシュボードのローディング状態を待つ
   */
  async waitForDashboardToLoad(): Promise<void> {
    await this.waitForElement(this.selectors.welcomeMessage);
    await this.waitForLoadingToComplete();
  }

  /**
   * クイックアクションを実行
   */
  async performQuickAction(actionName: string): Promise<void> {
    const quickActionSelector = `button:has-text("${actionName}"), a:has-text("${actionName}")`;
    if (await this.isElementVisible(quickActionSelector)) {
      await this.click(quickActionSelector);
      await this.waitForLoadingToComplete();
    }
  }

  /**
   * ダッシュボードのデータをリフレッシュ
   */
  async refreshDashboard(): Promise<void> {
    const refreshButton = 'button[aria-label*="refresh"], button:has-text("更新"), button:has-text("Refresh")';
    if (await this.isElementVisible(refreshButton)) {
      await this.click(refreshButton);
      await this.waitForLoadingToComplete();
    } else {
      await this.reload();
    }
  }
}
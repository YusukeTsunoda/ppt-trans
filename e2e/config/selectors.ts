/**
 * E2Eテスト用セレクタの中央管理
 * ハードコーディングを避け、保守性を向上
 */

export const SELECTORS = {
  // 認証関連
  auth: {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '[role="alert"], .error-message, .bg-red-50',
    successMessage: '[data-testid="login-success"], .success-message',
    logoutButton: 'button:has-text("ログアウト"), a:has-text("ログアウト")'
  },
  
  // アップロード関連
  upload: {
    fileInput: 'input[type="file"]',
    uploadButton: '[data-testid="upload-button"], button:has-text("アップロード")',
    progressIndicator: '[data-testid="upload-progress"], .loading-spinner',
    successMessage: '[data-testid="upload-success"]',
    errorMessage: '[data-testid="upload-error"], [role="alert"]',
    fileNameDisplay: '[data-testid="file-name"]',
    fileSizeDisplay: '[data-testid="file-size"]'
  },
  
  // ダッシュボード関連
  dashboard: {
    fileList: '[data-testid="file-list"], .file-list',
    fileItem: '[data-testid="file-item"], tr:has(td)',
    emptyState: '[data-testid="empty-file-list"]',
    refreshButton: 'button[title="更新"]',
    newUploadButton: 'a:has-text("新規アップロード")'
  },
  
  // 共通
  common: {
    loadingSpinner: '.loading-spinner, [data-testid="loading"]',
    modal: '[role="dialog"]',
    modalCloseButton: '[aria-label="モーダルを閉じる"]',
    notification: '[role="status"], [role="alert"]',
    errorBoundary: '[data-testid="error-boundary"]'
  }
} as const;

/**
 * データ属性を追加するための推奨属性名
 */
export const DATA_TEST_IDS = {
  // フォーム要素
  'email-input': 'email-input',
  'password-input': 'password-input',
  'login-submit': 'login-submit',
  'register-submit': 'register-submit',
  
  // ファイル操作
  'file-input': 'file-input',
  'upload-button': 'upload-button',
  'upload-progress': 'upload-progress',
  'upload-success': 'upload-success',
  'upload-error': 'upload-error',
  
  // ダッシュボード
  'file-list': 'file-list',
  'file-item': 'file-item',
  'empty-file-list': 'empty-file-list',
  'file-actions': 'file-actions',
  
  // ナビゲーション
  'nav-dashboard': 'nav-dashboard',
  'nav-upload': 'nav-upload',
  'nav-settings': 'nav-settings',
  'nav-logout': 'nav-logout'
} as const;

/**
 * 動的セレクタの生成
 */
export function getDynamicSelector(baseSelector: string, value: string): string {
  return `${baseSelector}:has-text("${value}")`;
}

/**
 * data-testid属性によるセレクタ生成
 */
export function getTestIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * 複数セレクタの結合
 */
export function combineSelectors(...selectors: string[]): string {
  return selectors.join(', ');
}
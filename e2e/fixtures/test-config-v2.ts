/**
 * E2E Test Configuration v2
 * 統一された設定管理
 */

import path from 'path';

export const TEST_CONFIG = {
  // タイムアウト設定
  timeouts: {
    quick: 5000,      // 簡単な操作
    standard: 10000,  // 標準的な操作
    upload: 30000,    // ファイルアップロード
    translation: 60000, // 翻訳処理
    navigation: 5000,  // ページ遷移
    element: 5000,     // 要素の表示待ち
  },
  
  // テストユーザー
  users: {
    standard: {
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'Test123',
    },
    admin: {
      email: process.env.ADMIN_USER_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_USER_PASSWORD || 'Admin123',
    },
    new: () => ({
      email: `test-${Date.now()}@example.com`,
      password: `Test${Date.now()}!@#`,
    }),
  },
  
  // テストファイル
  testFiles: {
    small: path.join(__dirname, 'test-files/small.pptx'),
    medium: path.join(__dirname, 'test-files/medium.pptx'),
    large: path.join(__dirname, 'test-files/large.pptx'),
    invalid: path.join(__dirname, 'test-files/invalid.txt'),
    presentation: path.join(__dirname, 'test-presentation.pptx'),
  },
  
  // 成功メッセージ
  successMessages: {
    uploadSuccess: 'ファイルが正常にアップロードされました',
    translationComplete: '翻訳が完了しました',
    downloadReady: 'ダウンロードの準備ができました',
    deleteSuccess: 'ファイルが削除されました',
  },
  
  // エラーメッセージ
  errorMessages: {
    invalidFileType: '対応していないファイル形式です',
    fileTooLarge: 'ファイルサイズが大きすぎます',
    uploadFailed: 'アップロードに失敗しました',
    translationFailed: '翻訳に失敗しました',
    networkError: 'ネットワークエラーが発生しました',
  },
  
  // リトライ設定
  retry: {
    auth: {
      maxAttempts: 3,
      delay: 1000,
    },
    upload: {
      maxAttempts: 2,
      delay: 2000,
    },
    translation: {
      maxAttempts: 1,
      delay: 5000,
    },
  },
  
  // 認証設定
  auth: {
    storageStateFile: path.join(process.cwd(), 'playwright-auth.json'),
    sessionTimeout: 3600000, // 1時間
  },
  
  // データ属性
  testIds: {
    // 認証関連
    emailInput: 'email',
    passwordInput: 'password',
    loginSubmit: 'login-submit',
    logoutButton: 'logout',
    
    // アップロード関連
    fileInput: 'file-input',
    uploadSubmit: 'upload-submit',
    uploadSuccess: 'upload-success',
    uploadProgress: 'upload-progress',
    
    // 翻訳関連
    translateButton: 'translate-button',
    translateModal: 'translate-modal',
    sourceLanguage: 'source-language',
    targetLanguage: 'target-language',
    translateStart: 'translate-start',
    translationComplete: 'translation-complete',
    
    // ダウンロード関連
    downloadButton: 'download-button',
    downloadTranslated: 'download-translated',
    
    // ファイル管理
    fileList: 'file-list',
    fileRow: 'file-row',
    deleteButton: 'delete-button',
    deleteConfirm: 'delete-confirm',
    
    // エラー表示
    errorMessage: 'error-message',
    errorInvalidFormat: 'error-invalid-format',
    errorFileTooLarge: 'error-file-too-large',
  },
};

// ヘルパー関数
export function getTestId(id: keyof typeof TEST_CONFIG.testIds): string {
  return `[data-testid="${TEST_CONFIG.testIds[id]}"]`;
}

export function generateTestUser() {
  return TEST_CONFIG.users.new();
}

export function getTestFile(type: keyof typeof TEST_CONFIG.testFiles): string {
  return TEST_CONFIG.testFiles[type];
}
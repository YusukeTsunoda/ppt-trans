/**
 * E2Eテスト設定の中央管理
 * ハードコーディングを排除し、設定を一元化
 */

/**
 * テスト環境設定
 */
export const TEST_CONFIG = {
  // 基本設定
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  testPort: process.env.TEST_PORT || '3000',
  
  // タイムアウト設定
  timeouts: {
    navigation: parseInt(process.env.TEST_NAVIGATION_TIMEOUT || '15000'),
    action: parseInt(process.env.TEST_ACTION_TIMEOUT || '30000'),
    test: parseInt(process.env.TEST_TIMEOUT || '60000'),
    networkIdle: 3000,
    elementVisible: 5000,
    formSubmission: 10000
  },
  
  // 認証設定
  auth: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'testpassword123',
    storageStateFile: process.env.AUTH_STATE_FILE || '.auth/test-auth.json',
    maxRetries: 3,
    retryDelay: 1000
  },
  
  // MSW設定
  msw: {
    enabled: process.env.USE_MSW_MOCKS === 'true',
    handlers: 'default',
    logging: process.env.LOG_LEVEL === 'debug'
  },
  
  // デバッグ設定
  debug: {
    screenshotOnFailure: process.env.SCREENSHOT_ON_FAILURE === 'true',
    videoOnFailure: process.env.VIDEO_ON_FAILURE === 'true',
    traceOnFailure: true,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0
  },
  
  // 並列実行設定
  parallel: {
    workers: parseInt(process.env.TEST_PARALLEL_WORKERS || '1'),
    fullyParallel: false,
    maxFailures: 5
  },
  
  // リトライ設定
  retry: {
    count: parseInt(process.env.TEST_RETRY_COUNT || '2'),
    onlyOnCI: true
  }
} as const;

/**
 * URLパターン
 */
export const URL_PATTERNS = {
  login: '**/login',
  dashboard: '**/dashboard',
  upload: '**/upload',
  settings: '**/settings',
  profile: '**/profile',
  api: {
    auth: '**/api/auth/**',
    files: '**/api/files/**',
    translate: '**/api/translate/**'
  }
} as const;

/**
 * テストデータ
 */
export const TEST_DATA = {
  // 有効なファイル
  validFiles: {
    pptx: 'test-presentation.pptx',
    ppt: 'test-presentation.ppt'
  },
  
  // 無効なファイル
  invalidFiles: {
    text: 'invalid-file.txt',
    pdf: 'invalid-file.pdf',
    large: 'large-file.pptx' // 100MB以上
  },
  
  // テストテキスト
  sampleText: {
    japanese: 'これはテストです',
    english: 'This is a test',
    mixed: 'これは test です'
  }
} as const;

/**
 * エラーメッセージパターン
 */
export const ERROR_PATTERNS = {
  auth: {
    invalidCredentials: /認証に失敗|メールアドレスまたはパスワードが正しくありません|Invalid credentials/i,
    sessionExpired: /セッションが期限切れ|Session expired/i,
    accountLocked: /アカウントがロック|Account locked/i
  },
  
  upload: {
    invalidFormat: /無効な形式|ファイル形式|Invalid format|Only .pptx/i,
    fileTooLarge: /ファイルサイズ|File too large|Maximum size/i,
    uploadFailed: /アップロード失敗|Upload failed/i
  },
  
  network: {
    timeout: /タイムアウト|Timeout/i,
    connectionError: /接続エラー|Connection error/i,
    serverError: /サーバーエラー|Server error|500/i
  }
} as const;

/**
 * 環境判定
 */
export const ENV = {
  isCI: !!process.env.CI,
  isDebug: process.env.DEBUG === 'true',
  isTestMode: process.env.NEXT_PUBLIC_TEST_MODE === 'true',
  isMSWEnabled: process.env.USE_MSW_MOCKS === 'true'
} as const;

/**
 * テスト設定を取得
 */
export function getTestConfig<K extends keyof typeof TEST_CONFIG>(
  key: K
): typeof TEST_CONFIG[K] {
  return TEST_CONFIG[key];
}

/**
 * 環境に応じたタイムアウト値を取得
 */
export function getTimeout(type: keyof typeof TEST_CONFIG.timeouts): number {
  const baseTimeout = TEST_CONFIG.timeouts[type];
  
  // CI環境では2倍の時間を許容
  if (ENV.isCI) {
    return baseTimeout * 2;
  }
  
  // デバッグモードでは5倍の時間を許容
  if (ENV.isDebug) {
    return baseTimeout * 5;
  }
  
  return baseTimeout;
}

/**
 * テストをスキップすべきか判定
 */
export function shouldSkipTest(condition: 'ci' | 'local' | 'msw'): boolean {
  switch (condition) {
    case 'ci':
      return !ENV.isCI;
    case 'local':
      return ENV.isCI;
    case 'msw':
      return !ENV.isMSWEnabled;
    default:
      return false;
  }
}
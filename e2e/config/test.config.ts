/**
 * E2Eテスト用環境設定
 * 環境変数による設定の一元管理
 */

export const testConfig = {
  // 基本URL（環境変数から取得、デフォルト値を提供）
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  
  // Supabase設定
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  },
  
  // タイムアウト設定
  timeouts: {
    navigation: 30000,  // ページ遷移
    action: 10000,      // ユーザーアクション
    upload: 60000,      // ファイルアップロード
    translation: 120000 // 翻訳処理
  },
  
  // ファイルサイズ制限
  limits: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    minFileSize: 1024,              // 1KB
    allowedExtensions: ['.pptx', '.ppt']
  },
  
  // テストモード設定
  testMode: {
    headless: process.env.CI === 'true',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    screenshot: process.env.SCREENSHOT === 'true',
    video: process.env.VIDEO === 'true'
  },
  
  // デバッグ設定
  debug: {
    verbose: process.env.DEBUG === 'true',
    pauseOnFailure: process.env.PAUSE_ON_FAILURE === 'true'
  }
};

// 設定値の検証
export function validateConfig(): void {
  if (!testConfig.supabase.anonKey) {
    console.warn('⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  
  if (!testConfig.supabase.serviceKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set - some tests may fail');
  }
  
  console.log(`🔧 Test Configuration:
    - Base URL: ${testConfig.baseUrl}
    - Headless: ${testConfig.testMode.headless}
    - Timeouts: Navigation=${testConfig.timeouts.navigation}ms, Upload=${testConfig.timeouts.upload}ms
  `);
}
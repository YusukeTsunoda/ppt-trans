/**
 * E2Eテスト設定 - 厳格な環境変数管理
 * 
 * すべてのテスト環境変数を必須化し、
 * ハードコードされた値への依存を排除
 */

// 環境変数の検証（段階的移行のため警告のみ）
function getRequiredEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value) {
    if (defaultValue) {
      console.warn(
        `⚠️ 環境変数 ${key} が設定されていません。デフォルト値を使用します: ${defaultValue}\n` +
        `本番環境では必ず設定してください。`
      );
      return defaultValue;
    }
    throw new Error(
      `必須環境変数 ${key} が設定されていません。\n` +
      `.env.test ファイルを作成し、以下の変数を設定してください:\n` +
      `- TEST_USER_EMAIL: テスト用ユーザーのメールアドレス\n` +
      `- TEST_USER_PASSWORD: テスト用ユーザーのパスワード\n` +
      `- NEXT_PUBLIC_SUPABASE_URL: SupabaseのURL\n` +
      `- NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabaseの匿名キー`
    );
  }
  return value;
}

// テスト設定
export const TEST_CONFIG = {
  // 認証情報（段階的移行のため一時的にデフォルト値を許可）
  auth: {
    email: getRequiredEnv('TEST_USER_EMAIL', 'test@example.com'),
    password: getRequiredEnv('TEST_USER_PASSWORD', 'testpassword123'),
    // 新規登録テスト用（ランダム生成）
    newEmail: `test-${Date.now()}@example.com`,
    newPassword: `Test${Date.now()}!@#`
  },
  
  // Supabase設定（デフォルト値付き）
  supabase: {
    url: getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321'),
    anonKey: getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key'),
  },
  
  // タイムアウト設定（厳格化）
  timeouts: {
    navigation: 5000,  // ページ遷移: 5秒
    element: 3000,     // 要素表示: 3秒
    api: 10000,        // API応答: 10秒
    upload: 30000,     // ファイルアップロード: 30秒
  },
  
  // エラーメッセージ（正確な文言）
  errorMessages: {
    loginFailed: 'メールアドレスまたはパスワードが正しくありません',
    passwordMismatch: 'パスワードが一致しません',
    emailRequired: 'メールアドレスを入力してください',
    passwordRequired: 'パスワードを入力してください',
    invalidFileType: 'PowerPointファイル（.pptx）を選択してください',
    fileSizeExceeded: 'ファイルサイズが10MBを超えています',
    uploadFailed: 'アップロードに失敗しました',
  },
  
  // 成功メッセージ（正確な文言）
  successMessages: {
    loginSuccess: 'ログインしました',
    signupSuccess: 'アカウントを作成しました',
    uploadSuccess: 'ファイルをアップロードしました',
    logoutSuccess: 'ログアウトしました',
  },
  
  // テスト実行モード
  mode: {
    isCI: process.env.CI === 'true',
    isDebug: process.env.DEBUG === 'true',
    retryCount: process.env.CI === 'true' ? 2 : 0,
  }
} as const;

// 型定義のエクスポート
export type TestConfig = typeof TEST_CONFIG;
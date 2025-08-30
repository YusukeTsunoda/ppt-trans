# E2Eテスト作成ガイドライン

## 目的
このガイドラインは、保守性が高く、環境間で移植可能なE2Eテストを作成するための指針を提供します。

## 必須ルール

### 1. 設定の一元管理
すべての設定は `e2e/config/unified-test-config.ts` から取得してください。

```typescript
// ✅ 正しい例
import { UNIFIED_TEST_CONFIG } from '../config/unified-test-config';

await page.fill('input[name="email"]', UNIFIED_TEST_CONFIG.users.standard.email);
await page.fill('input[name="password"]', UNIFIED_TEST_CONFIG.users.standard.password);

// ❌ 悪い例（ハードコーディング）
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="password"]', 'Test123!');
```

### 2. URLの動的生成
URLは必ず設定から取得し、環境に依存しないようにしてください。

```typescript
// ✅ 正しい例
await page.goto(`${UNIFIED_TEST_CONFIG.baseUrl}/login`);

// ❌ 悪い例（固定URL）
await page.goto('http://localhost:3000/login');
await page.goto('http://localhost:3001/login');
```

### 3. テストデータの動的生成
新規ユーザー作成などのテストでは、動的にデータを生成してください。

```typescript
// ✅ 正しい例
const newUser = UNIFIED_TEST_CONFIG.generateUser();
await page.fill('input[name="email"]', newUser.email);

// ❌ 悪い例（固定値）
await page.fill('input[name="email"]', 'newuser@example.com');
```

### 4. セレクターの統一
共通のセレクターは設定から取得してください。

```typescript
// ✅ 正しい例
const emailInput = page.locator(UNIFIED_TEST_CONFIG.selectors.auth.emailInput);
const submitButton = page.locator(UNIFIED_TEST_CONFIG.selectors.auth.submitButton);

// ❌ 悪い例（セレクターの重複）
const emailInput = page.locator('input[type="email"]');
const submitButton = page.locator('button[type="submit"]');
```

### 5. タイムアウトの設定
タイムアウトは設定から取得してください。

```typescript
// ✅ 正しい例
await page.waitForURL('**/dashboard', { 
  timeout: UNIFIED_TEST_CONFIG.timeouts.navigation 
});

// ❌ 悪い例（マジックナンバー）
await page.waitForURL('**/dashboard', { timeout: 5000 });
```

## 禁止事項

### ❌ 絶対に避けるべきこと
1. **ハードコードされた認証情報**
   - `test@example.com`, `admin@example.com`
   - `Test123!`, `Admin123!`, `testpassword123`

2. **固定のポート番号とURL**
   - `http://localhost:3000`
   - `http://localhost:3001`

3. **`.only()` の使用**
   - コミット前に必ず削除してください

4. **無条件の `test.skip()`**
   - 条件付きスキップを使用してください

## 推奨パターン

### Page Object Model (POM)
複雑なページにはPage Objectパターンを使用してください。

```typescript
// pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async login(email: string, password: string) {
    await this.page.fill(UNIFIED_TEST_CONFIG.selectors.auth.emailInput, email);
    await this.page.fill(UNIFIED_TEST_CONFIG.selectors.auth.passwordInput, password);
    await this.page.click(UNIFIED_TEST_CONFIG.selectors.auth.submitButton);
  }
}
```

### ヘルパー関数
共通の操作はヘルパー関数として抽出してください。

```typescript
// helpers/auth-helper.ts
export async function loginAsStandardUser(page: Page) {
  const { email, password } = UNIFIED_TEST_CONFIG.users.standard;
  await page.goto(`${UNIFIED_TEST_CONFIG.baseUrl}/login`);
  await page.fill(UNIFIED_TEST_CONFIG.selectors.auth.emailInput, email);
  await page.fill(UNIFIED_TEST_CONFIG.selectors.auth.passwordInput, password);
  await page.click(UNIFIED_TEST_CONFIG.selectors.auth.submitButton);
}
```

### 条件付きスキップ
機能が未実装の場合は、条件付きでスキップしてください。

```typescript
test('レート制限のテスト', async ({ page }) => {
  if (!UNIFIED_TEST_CONFIG.features.rateLimit) {
    console.log('⚠️ レート制限機能が無効のためスキップ');
    test.skip();
    return;
  }
  // テストの実装
});
```

## テスト作成チェックリスト

テストを作成する前に、以下を確認してください：

- [ ] `unified-test-config.ts` をインポートしているか
- [ ] ハードコードされた値がないか
- [ ] URLは設定から取得しているか
- [ ] タイムアウトは設定から取得しているか
- [ ] セレクターは統一されているか
- [ ] `.only()` を使用していないか
- [ ] 適切なエラーハンドリングがあるか
- [ ] テストは独立して実行可能か

## テスト実行前の確認

```bash
# ハードコーディングのチェック
npm run test:check-hardcoding

# 環境変数の確認
npm run test:check-env

# テストの実行
npm run test:e2e
```

## トラブルシューティング

### 環境変数が設定されていない場合
```bash
cp .env.test.example .env.test
# .env.testファイルを編集して適切な値を設定
```

### テストが失敗する場合
1. 環境変数が正しく設定されているか確認
2. テストユーザーが実際に存在するか確認
3. 開発サーバーが起動しているか確認
4. ポートが競合していないか確認

## 継続的改善

このガイドラインは定期的に見直し、改善してください。
新しいパターンや問題が発見された場合は、このドキュメントを更新してください。
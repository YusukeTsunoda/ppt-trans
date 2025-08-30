# E2Eテスト修正計画

## 実施日
2025-08-30

## 目的
E2Eテストの品質向上と保守性の改善を通じて、継続的なテスト実行を可能にする

## 問題の詳細分析

### 1. ハードコーディング問題

#### 影響を受けるファイル（優先度順）
1. **e2e/debug-server-actions.spec.ts**
   - 行46-47: `'test@example.com'`, `'testpassword123'`
   - 行99-100: 同じ値を再度使用

2. **e2e/login-test.spec.ts**
   - 行30-31: `'test@example.com'`, `'Test123!'`
   - 行48, 84-85, 158-159: 同じ値を複数回使用

3. **e2e/simple-login-test.spec.ts**
   - 行6: `'http://localhost:3001/login'` (URLもハードコード)
   - 行21, 26: `'test@example.com'`, `'Test123!'`
   - 行80, 85: `'admin@example.com'`, `'Admin123!'`

### 2. スキップされているテスト

#### カテゴリー別分析
- **機能未実装**: レート制限、パスワードリセット
- **テストデータ不足**: 大容量ファイル
- **技術的制約**: CI環境での制限

### 3. テストの重複

#### 認証テストの分散
- 同じログイン機能を5個以上のファイルでテスト
- それぞれ微妙に異なる実装
- メンテナンス負荷が高い

## 修正計画

### フェーズ1: 環境変数とテスト設定の統一（即座に実施）

#### 1.1 環境変数ファイルの作成
```bash
# .env.test
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=Test123!
ADMIN_USER_EMAIL=admin@example.com
ADMIN_USER_PASSWORD=Admin123!
BASE_URL=http://localhost:3000
```

#### 1.2 統一設定ファイルの作成
```typescript
// e2e/config/unified-test-config.ts
export const UNIFIED_TEST_CONFIG = {
  // 環境変数から取得（必須）
  users: {
    standard: {
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    },
    admin: {
      email: process.env.ADMIN_USER_EMAIL!,
      password: process.env.ADMIN_USER_PASSWORD!,
    },
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  
  // タイムアウト設定
  timeouts: {
    quick: 5000,
    standard: 10000,
    upload: 30000,
    translation: 60000,
  },
  
  // テストデータ生成
  generateUser: () => ({
    email: `test-${Date.now()}@example.com`,
    password: `Test${Date.now()}!@#`,
  }),
};
```

### フェーズ2: ハードコーディングの修正（各ファイル個別対応）

#### 2.1 debug-server-actions.spec.ts の修正
```typescript
// 修正前
await page.fill('[name="email"]', 'test@example.com');
await page.fill('[name="password"]', 'testpassword123');

// 修正後
import { UNIFIED_TEST_CONFIG } from '../config/unified-test-config';
await page.fill('[name="email"]', UNIFIED_TEST_CONFIG.users.standard.email);
await page.fill('[name="password"]', UNIFIED_TEST_CONFIG.users.standard.password);
```

#### 2.2 login-test.spec.ts の修正
```typescript
// 修正前
await page.fill('input[name="email"]', 'test@example.com');
await page.fill('input[name="password"]', 'Test123!');

// 修正後
import { UNIFIED_TEST_CONFIG } from '../config/unified-test-config';
const { email, password } = UNIFIED_TEST_CONFIG.users.standard;
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
```

#### 2.3 simple-login-test.spec.ts の修正
```typescript
// 修正前
await page.goto('http://localhost:3001/login');
await emailInput.fill('test@example.com');

// 修正後
import { UNIFIED_TEST_CONFIG } from '../config/unified-test-config';
await page.goto(`${UNIFIED_TEST_CONFIG.baseUrl}/login`);
await emailInput.fill(UNIFIED_TEST_CONFIG.users.standard.email);
```

### フェーズ3: スキップテストの解決

#### 3.1 条件付きスキップへの変更
```typescript
// 修正前
test.skip('大容量ファイルのアップロード（10MB）', async ({ page }) => {

// 修正後
test('大容量ファイルのアップロード（10MB）', async ({ page }) => {
  // テストファイルが存在する場合のみ実行
  const largeFile = path.join(__dirname, '../fixtures/large-10mb.pptx');
  if (!fs.existsSync(largeFile)) {
    console.log('⚠️ テストファイルが存在しないためスキップ');
    test.skip();
    return;
  }
  // テスト実行
});
```

#### 3.2 フィーチャーフラグによる制御
```typescript
// 環境変数で機能の有効/無効を管理
const FEATURES = {
  rateLimit: process.env.FEATURE_RATE_LIMIT === 'true',
  passwordReset: process.env.FEATURE_PASSWORD_RESET === 'true',
};

test('API rate limiting', async ({ page }) => {
  if (!FEATURES.rateLimit) {
    console.log('レート制限機能が無効のためスキップ');
    test.skip();
    return;
  }
  // テスト実行
});
```

### フェーズ4: テスト重複の整理

#### 4.1 認証テストの統合
```typescript
// e2e/core/auth-unified.spec.ts
import { test } from '@playwright/test';
import { AuthTestHelper } from '../helpers/auth-helper';

test.describe('統合認証テスト', () => {
  const auth = new AuthTestHelper();
  
  test('標準ユーザーログイン', async ({ page }) => {
    await auth.loginAsStandardUser(page);
  });
  
  test('管理者ログイン', async ({ page }) => {
    await auth.loginAsAdmin(page);
  });
  
  test('ログアウト', async ({ page }) => {
    await auth.logout(page);
  });
});
```

#### 4.2 古いテストファイルの削除計画
```bash
# 削除対象（統合後）
- e2e/auth/auth-flow.spec.ts
- e2e/auth/auth-comprehensive.spec.ts
- e2e/core/auth-admin.spec.ts
- e2e/core/auth-simple.spec.ts
- e2e/login-test.spec.ts
- e2e/simple-login-test.spec.ts
- e2e/direct-login-test.spec.ts
- e2e/server-action-login.spec.ts
```

### フェーズ5: 再発防止策の実装

#### 5.1 ESLintルールの追加
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // E2Eテストでのハードコーディング検出
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/test@example\\.com|admin@example\\.com|Test123|Admin123/]',
        message: 'ハードコードされた認証情報は使用しないでください。TEST_CONFIGを使用してください。',
      },
    ],
  },
};
```

#### 5.2 pre-commitフックの設定
```json
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# E2Eテストのハードコーディングチェック
echo "E2Eテストのハードコーディングをチェック中..."
if grep -r "test@example.com\|admin@example.com\|Test123\|Admin123" e2e/*.spec.ts; then
  echo "❌ ハードコードされた値が検出されました。TEST_CONFIGを使用してください。"
  exit 1
fi

echo "✅ ハードコーディングチェック完了"
```

#### 5.3 テスト作成ガイドラインの策定
```markdown
# e2e/GUIDELINES.md

## E2Eテスト作成ガイドライン

### 必須ルール
1. 認証情報は必ず`UNIFIED_TEST_CONFIG`から取得する
2. URLは環境変数またはconfigから取得する
3. テストデータは動的に生成する
4. スキップする場合は理由を明記する

### 禁止事項
- ハードコードされた認証情報
- 固定のポート番号
- `.only()`の使用（コミット前に削除）

### 推奨パターン
- Page Object Modelの使用
- ヘルパー関数の活用
- 適切なタイムアウト設定
```

## 実装順序

1. **即座に実施**（優先度: 高）
   - [ ] .env.testファイルの作成
   - [ ] unified-test-config.tsの作成
   - [ ] 環境変数の検証関数追加

2. **24時間以内**（優先度: 高）
   - [ ] ハードコードされた値の修正（5ファイル）
   - [ ] テスト実行確認

3. **1週間以内**（優先度: 中）
   - [ ] スキップテストの条件付き化
   - [ ] フィーチャーフラグの実装

4. **2週間以内**（優先度: 低）
   - [ ] 重複テストの統合
   - [ ] 古いテストファイルの削除
   - [ ] ドキュメント更新

## 成功指標

- ✅ ハードコーディング: 0件
- ✅ 無条件スキップ: 0件
- ✅ テスト実行時間: 5分以内
- ✅ 環境間での実行成功率: 100%

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 既存テストの破壊 | 高 | 段階的な修正とテスト実行 |
| 環境変数の不足 | 中 | デフォルト値の提供と警告 |
| CI/CDパイプラインへの影響 | 高 | CI環境での事前テスト |
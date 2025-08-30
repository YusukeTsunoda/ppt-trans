# 各フェーズ実装用プロンプト集（Sonnet用）

このドキュメントは、各フェーズをClaude 3.5 Sonnetで確実に実装するための詳細なプロンプトを提供します。
各プロンプトをそのままコピー＆ペーストして使用できます。

---

## Phase 1: 基盤整備とツール準備（4時間）

### プロンプト 1.1: 自動変換スクリプトの作成

```
以下の要件で、E2Eテストファイル内のハードコードされたテストデータを自動的にTestDataFactoryに置換するTypeScriptスクリプトを作成してください。

【ファイルパス】
scripts/migrate-test-data.ts

【要件】
1. e2eディレクトリ内の全*.spec.tsと*.test.tsファイルを対象とする
2. 以下のパターンを検出して置換する：
   - 'test@example.com' → TestDataFactory.createUser().email
   - 'admin@example.com' → TestDataFactory.createAdminUser().email
   - 'Test123' または 'Admin123' → TestDataFactory.generateSecurePassword()
   - { email: 'test@example.com', password: 'Test123' } → TestDataFactory.createUser()
   - process.env.TEST_USER_EMAIL || 'test@example.com' → process.env.TEST_USER_EMAIL || TestDataFactory.createUser().email

3. TestDataFactoryのimport文を自動追加（まだインポートされていない場合）：
   import { TestDataFactory } from '../fixtures/test-data-factory';
   ※既存のimport文の最後に追加

4. 変更されたファイルのリストを出力
5. --dry-runオプションで実際の変更なしに変更内容をプレビュー
6. バックアップを自動作成（.backup拡張子を追加）

【実行コマンド】
npm run migrate:test-data [--dry-run]

【エラーハンドリング】
- ファイル読み書きエラーを適切にキャッチ
- 部分的な成功/失敗をレポート
- ロールバック機能を提供

実装には以下を使用：
- fs.promises for async file operations
- glob for file pattern matching
- chalk for colored console output
- commander for CLI arguments
```

### プロンプト 1.2: ESLintカスタムルールの作成

```
E2Eテストでハードコードされたテストデータを検出し、自動修正も可能なESLintカスタムルールを作成してください。

【ファイルパス】
eslint-rules/no-hardcoded-test-data.js

【検出パターン】
以下の文字列リテラルを検出：
- test@example.com
- admin@example.com  
- Test123, Admin123, password123
- localhost:3000（環境変数を使うべき）
- 固定のユーザーID（例：user-123, admin-456）

【自動修正ロジック】
1. メールアドレス → TestDataFactory.createUser().email
2. パスワード → TestDataFactory.generateSecurePassword()
3. localhost:3000 → process.env.BASE_URL || 'http://localhost:3000'
4. 固定ID → TestDataFactory.generateId()

【レポート内容】
- エラーレベル: error
- メッセージ: "Hardcoded test data '${value}' detected. Use TestDataFactory instead."
- 提案: 具体的な置換コードを提示

【設定ファイル更新】
.eslintrc.jsに以下を追加：
```javascript
rules: {
  'no-hardcoded-test-data': 'error'
}
```

【除外設定】
test-data-factory.ts自体は検査対象外とする
```

### プロンプト 1.3: Pre-commitフックの設定

```
Huskyを使用して、コミット前にハードコードされたテストデータを検出するpre-commitフックを設定してください。

【ファイルパス】
.husky/pre-commit

【チェック項目】
1. ハードコードされたテストデータの検出
   - grep -r "test@example.com\|Test123\|Admin123" e2e/ --include="*.ts"
   - 検出された場合はコミットをブロック

2. ESLintチェック
   - npm run lint:e2e
   - エラーがある場合はコミットをブロック

3. TypeScriptコンパイルチェック
   - npm run type-check
   - 型エラーがある場合はコミットをブロック

4. 部分的なテスト実行（変更されたファイルのみ）
   - 変更されたテストファイルを検出
   - 該当ファイルのテストのみ実行

【エラー表示】
各チェックで失敗した場合：
- ❌ マークと具体的なエラー内容を表示
- 修正方法の提案を表示
- 関連するドキュメントへのリンク

【成功表示】
全チェック通過時：
✅ Pre-commit checks passed!

【スキップオプション】
緊急時のみ: git commit --no-verify
（ただし警告メッセージを表示）

【初期設定コマンド】
npx husky-init && npm install
npx husky add .husky/pre-commit "chmod +x .husky/pre-commit"
```

### プロンプト 1.4: バックアップとロールバックシステム

```
テストファイルの自動バックアップとロールバック機能を実装してください。

【ファイルパス】
scripts/backup-manager.ts

【機能】
1. バックアップ作成
   - e2eディレクトリ全体を e2e.backup.YYYYMMDD-HHMMSS/ にコピー
   - 最大5世代まで保持（古いものから自動削除）
   - バックアップメタデータをJSONで保存

2. ロールバック
   - 特定の日時のバックアップに戻す
   - 差分表示機能
   - 部分的なロールバック（特定ファイルのみ）

3. 差分確認
   - 現在の状態とバックアップの差分を表示
   - 変更されたファイルのリスト
   - 追加/削除された行数のサマリー

【CLIコマンド】
npm run backup:create -- --message "Before TestDataFactory migration"
npm run backup:list
npm run backup:restore -- --id <backup-id>
npm run backup:diff -- --id <backup-id>
npm run backup:clean -- --keep 3

【メタデータ形式】
{
  "id": "20240101-120000",
  "timestamp": "2024-01-01T12:00:00Z",
  "message": "Before TestDataFactory migration",
  "filesCount": 59,
  "totalSize": "2.5MB",
  "changes": {
    "modified": 45,
    "added": 5,
    "deleted": 2
  }
}
```

---

## Phase 2: 全テストファイルへの一括適用（8時間）

### プロンプト 2.1: Critical Priorityファイルの移行

```
以下の10個のCritical Priorityテストファイルを、TestDataFactoryを使用するように修正してください。

【対象ファイル】
1. e2e/core/auth.spec.ts
2. e2e/core/csrf-protection.spec.ts
3. e2e/core/auth-flow-stable.spec.ts
4. e2e/core/admin-login.spec.ts
5. e2e/critical-user-journey.spec.ts
6. e2e/config/test-config.ts
7. e2e/mocks/handlers.ts
8. e2e/auth/setup-auth.ts
9. e2e/fixtures/global-setup.ts
10. e2e/fixtures/test-base.ts

【修正内容】
各ファイルで以下を実行：

1. import文の追加（まだない場合）:
   import { TestDataFactory, TestUser } from '../fixtures/test-data-factory';

2. ハードコードされた値の置換:
   - 'test@example.com' → testUser.email（事前にtestUser = TestDataFactory.createUser()）
   - 'Test123' → testUser.password
   - 直接のオブジェクト定義 → TestDataFactory.createUser()

3. beforeEach/beforeAllフックでのテストデータ準備:
   ```typescript
   let testUser: TestUser;
   
   beforeEach(async () => {
     testUser = TestDataFactory.createUser();
   });
   ```

4. 環境変数のフォールバック修正:
   ```typescript
   // Before
   process.env.TEST_USER_EMAIL || 'test@example.com'
   
   // After
   process.env.TEST_USER_EMAIL || TestDataFactory.createUser().email
   ```

5. モックハンドラーの修正:
   ```typescript
   // Before
   if (email === 'test@example.com' && password === 'Test123')
   
   // After
   const validUsers = TestDataFactory.createUsers(5);
   if (validUsers.some(u => u.email === email && u.password === password))
   ```

【検証】
修正後、以下のコマンドで確認：
npm run test:e2e -- --grep "auth|csrf|admin|critical"
```

### プロンプト 2.2: Page Objectファイルの一括更新

```
e2e/page-objects/ディレクトリ内の全Page Objectファイルを、TestDataFactoryを使用するように更新してください。

【対象ファイル】
- e2e/page-objects/login.page.ts（既に部分的に完了）
- e2e/page-objects/dashboard.page.ts
- e2e/page-objects/upload.page.ts
- e2e/page-objects/preview.page.ts
- e2e/page-objects/admin.page.ts
- e2e/page-objects/profile.page.ts

【各Page Objectに追加する共通メソッド】

1. テストユーザー管理:
```typescript
private testUser?: TestUser;

async setupTestUser(): Promise<TestUser> {
  this.testUser = TestDataFactory.createUser();
  return this.testUser;
}

async getTestUser(): TestUser {
  if (!this.testUser) {
    this.testUser = TestDataFactory.createUser();
  }
  return this.testUser;
}
```

2. 動的データ使用メソッド:
```typescript
async loginWithGeneratedUser(): Promise<void> {
  const user = await this.setupTestUser();
  await this.login(user.email, user.password);
}

async fillFormWithTestData(): Promise<void> {
  const user = await this.getTestUser();
  await this.emailInput.fill(user.email);
  await this.passwordInput.fill(user.password);
}
```

3. ハードコード値の除去:
```typescript
// Before
async loginAsDefault() {
  await this.login('test@example.com', 'Test123');
}

// After
async loginAsDefault() {
  const user = process.env.TEST_USER_EMAIL 
    ? { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD }
    : TestDataFactory.createUser();
  await this.login(user.email, user.password);
}
```

【特定ファイルの追加要件】

DashboardPage:
- ファイルアップロードテストデータ: TestDataFactory.createTestFile()
- プロジェクトデータ: TestDataFactory.createProject()

UploadPage:
- 大容量ファイル: TestDataFactory.scenarios.largeFile()
- 特殊文字ファイル: TestDataFactory.scenarios.specialCharFile()

AdminPage:
- 管理者ユーザー: TestDataFactory.createAdminUser()
- 複数ユーザー: TestDataFactory.createUsers(10)
```

### プロンプト 2.3: Helperファイルの更新

```
e2e/helpers/ディレクトリ内の全ヘルパーファイルをTestDataFactory対応に更新してください。

【対象ファイル】
- e2e/helpers/auth.helper.ts
- e2e/helpers/api.helper.ts
- e2e/helpers/file.helper.ts
- e2e/helpers/server-actions-helper.ts
- e2e/helpers/user-journey.helper.ts（既に完了）

【共通更新内容】

1. AuthHelper更新:
```typescript
export class AuthHelper {
  // ハードコード値を削除
  static async createAndLoginUser(page: Page): Promise<TestUser> {
    const user = TestDataFactory.createUser();
    // 実際のユーザー作成APIを呼ぶ、またはモック
    await this.registerUser(user);
    await this.loginUser(page, user);
    return user;
  }

  static async createMultipleTestUsers(count: number): Promise<TestUser[]> {
    return TestDataFactory.createUsers(count);
  }

  static async loginWithRole(page: Page, role: 'USER' | 'ADMIN'): Promise<TestUser> {
    const user = role === 'ADMIN' 
      ? TestDataFactory.createAdminUser()
      : TestDataFactory.createUser();
    await this.loginUser(page, user);
    return user;
  }
}
```

2. FileHelper更新:
```typescript
export class FileHelper {
  static generateTestFile(type?: 'pptx' | 'pdf' | 'docx'): TestFile {
    return TestDataFactory.createTestFile({ type });
  }

  static generateLargeFile(): TestFile {
    return TestDataFactory.scenarios.largeFile();
  }

  static generateInvalidFile(): TestFile {
    return {
      name: 'invalid.exe',
      path: '/tmp/invalid.exe',
      size: 1024,
      type: 'exe' as any // 意図的に無効な型
    };
  }
}
```

3. APIHelper更新:
```typescript
export class APIHelper {
  static async createTestData(): Promise<{
    user: TestUser;
    file: TestFile;
    project: TestProject;
  }> {
    return {
      user: TestDataFactory.createUser(),
      file: TestDataFactory.createTestFile(),
      project: TestDataFactory.createProject()
    };
  }

  static getMockHeaders(user?: TestUser): Headers {
    const testUser = user || TestDataFactory.createUser();
    return {
      'Authorization': `Bearer ${this.generateToken(testUser)}`,
      'X-User-Email': testUser.email
    };
  }
}
```

【バリデーション追加】
各ヘルパーにTestDataFactoryのバリデーターを使用：
```typescript
static isTestData(email: string): boolean {
  return TestDataFactory.validators.isTestEmail(email);
}

static validatePassword(password: string): boolean {
  return TestDataFactory.validators.isValidPassword(password);
}
```
```

### プロンプト 2.4: 残りの全テストファイル一括変換

```
以下のコマンドとスクリプトを使用して、残りの全テストファイル（約30ファイル）を一括で変換してください。

【実行手順】

1. まず現状確認:
```bash
# ハードコードが残っているファイルをリスト
grep -l "test@example.com\|Test123\|Admin123" e2e/**/*.{spec,test}.ts | grep -v test-data-factory > files-to-migrate.txt

# ファイル数確認
wc -l files-to-migrate.txt
```

2. 一括変換スクリプト実行:
```bash
# ドライラン（変更内容を確認）
npm run migrate:test-data -- --dry-run

# 実際の変換実行
npm run migrate:test-data

# 変換結果の確認
npm run migrate:test-data -- --verify
```

3. 手動修正が必要なパターンの特定と修正:
```typescript
// パターン1: 複雑な条件式
// Before
if (user.email === 'test@example.com' || user.email === 'admin@example.com')

// After
const testEmails = [TestDataFactory.createUser().email, TestDataFactory.createAdminUser().email];
if (testEmails.includes(user.email))

// パターン2: 文字列連結
// Before
const message = `Welcome test@example.com`;

// After
const testUser = TestDataFactory.createUser();
const message = `Welcome ${testUser.email}`;

// パターン3: 正規表現パターン
// Before
expect(email).toMatch(/test@example\.com/);

// After
expect(TestDataFactory.validators.isTestEmail(email)).toBe(true);
```

4. 各ファイルカテゴリごとの確認:
```bash
# features/ディレクトリ
npm run test:e2e -- e2e/features

# api/ディレクトリ  
npm run test:e2e -- e2e/api

# security/ディレクトリ
npm run test:e2e -- e2e/security

# performance/ディレクトリ
npm run test:e2e -- e2e/performance
```

5. 最終確認:
```bash
# ハードコードが残っていないことを確認
npm run validate:no-hardcode

# 全テスト実行
npm run test:e2e

# カバレッジ確認
npm run test:coverage
```

【トラブルシューティング】
- インポートパスエラー: 相対パスを調整
- 型エラー: TestUser型を明示的に指定
- 非同期エラー: await忘れをチェック
```

---

## Phase 3: Page Objectパターンの完全統一（4時間）

### プロンプト 3.1: Enhanced Base Page実装

```
全Page Objectが継承する拡張基底クラスを実装してください。

【ファイルパス】
e2e/page-objects/base-enhanced.page.ts

【実装要件】

```typescript
import { Page, Locator, expect } from '@playwright/test';
import { TestDataFactory, TestUser, TestFile } from '../fixtures/test-data-factory';

export interface PerformanceMetrics {
  pageLoadTime: number;
  domReady: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
}

export interface AccessibilityResults {
  hasProperHeadings: boolean;
  hasAltText: boolean;
  hasAriaLabels: boolean;
  isKeyboardNavigable: boolean;
  colorContrast: boolean;
  focusManagement: boolean;
}

export abstract class EnhancedBasePage {
  protected testUser?: TestUser;
  protected testFiles: TestFile[] = [];

  constructor(protected page: Page) {}

  // 必須実装メソッド（各Page Objectで実装必須）
  abstract validateUserValue(): Promise<boolean>;
  abstract getPageIdentifier(): string;
  abstract waitForPageLoad(): Promise<void>;

  // data-testid優先のセレクタ
  protected getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  // 複数要素の取得
  protected getAllByTestId(testId: string): Locator {
    return this.page.locator(`[data-testid="${testId}"]`);
  }

  // テストデータ管理
  async setupTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
    this.testUser = TestDataFactory.createUser(overrides);
    return this.testUser;
  }

  async getOrCreateTestUser(): Promise<TestUser> {
    if (!this.testUser) {
      this.testUser = TestDataFactory.createUser();
    }
    return this.testUser;
  }

  // ユーザー価値検証の共通メソッド
  async validateErrorMessage(): Promise<boolean> {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '[role="alert"]',
      '.error-message',
      '.text-red-600'
    ];

    for (const selector of errorSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        const text = await element.textContent();
        return this.isUserFriendlyError(text || '');
      }
    }
    return false;
  }

  private isUserFriendlyError(text: string): boolean {
    const technicalTerms = ['undefined', 'null', 'Error:', 'stack', 'trace', 'Exception'];
    const hasTechnicalTerms = technicalTerms.some(term => text.includes(term));
    const hasMinimumLength = text.length > 10;
    const hasHelpfulContent = /[。、！？]/.test(text) || /[.!?]/.test(text);
    
    return !hasTechnicalTerms && hasMinimumLength && hasHelpfulContent;
  }

  // アクセシビリティ検証
  async validateAccessibility(): Promise<AccessibilityResults> {
    const results: AccessibilityResults = {
      hasProperHeadings: await this.checkHeadingHierarchy(),
      hasAltText: await this.checkAltText(),
      hasAriaLabels: await this.checkAriaLabels(),
      isKeyboardNavigable: await this.checkKeyboardNavigation(),
      colorContrast: await this.checkColorContrast(),
      focusManagement: await this.checkFocusManagement()
    };

    return results;
  }

  private async checkHeadingHierarchy(): Promise<boolean> {
    const h1Count = await this.page.locator('h1').count();
    const headings = await this.page.locator('h1, h2, h3, h4, h5, h6').all();
    
    // h1は1つだけ、階層が適切か
    if (h1Count !== 1) return false;
    
    // TODO: 階層順序のチェック
    return true;
  }

  private async checkAltText(): Promise<boolean> {
    const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
    return imagesWithoutAlt === 0;
  }

  private async checkAriaLabels(): Promise<boolean> {
    const buttonsWithoutLabel = await this.page.locator('button:not([aria-label]):not(:has-text(*))').count();
    const linksWithoutLabel = await this.page.locator('a:not([aria-label]):not(:has-text(*))').count();
    return buttonsWithoutLabel === 0 && linksWithoutLabel === 0;
  }

  private async checkKeyboardNavigation(): Promise<boolean> {
    const nonAccessible = await this.page.locator('*[onclick]:not(button):not(a):not(input):not([tabindex])').count();
    return nonAccessible === 0;
  }

  private async checkColorContrast(): Promise<boolean> {
    // 簡易チェック - 実際はaxe-coreなどを使用
    return true;
  }

  private async checkFocusManagement(): Promise<boolean> {
    const focusableElements = await this.page.locator('button, a, input, select, textarea, [tabindex]').count();
    return focusableElements > 0;
  }

  // パフォーマンス測定
  async measurePerformance(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        domReady: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: 0, // PerformanceObserver必要
        timeToInteractive: navigation.domInteractive - navigation.fetchStart
      };
    });
  }

  // ネットワーク待機
  async waitForNetworkIdle(timeout: number = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  // スクリーンショット撮影（エラー時用）
  async captureScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${this.getPageIdentifier()}-${name}.png`,
      fullPage: true 
    });
  }

  // クリーンアップ
  async cleanup(): Promise<void> {
    // テストデータのクリーンアップ
    if (this.testUser && TestDataFactory.validators.isTestEmail(this.testUser.email)) {
      // APIコールまたはDBクリーンアップ
      console.log(`Cleaning up test user: ${this.testUser.email}`);
    }
    
    for (const file of this.testFiles) {
      if (TestDataFactory.validators.isTestFile(file.name)) {
        console.log(`Cleaning up test file: ${file.name}`);
      }
    }
  }
}
```

すべてのPage Objectをこの基底クラスを継承するように更新してください。
```

### プロンプト 3.2: 各Page Objectの統一実装

```
各Page ObjectをEnhancedBasePageを継承し、統一されたパターンで実装してください。

【実装テンプレート】

```typescript
// e2e/page-objects/dashboard.page.ts
import { Page, Locator } from '@playwright/test';
import { EnhancedBasePage } from './base-enhanced.page';
import { TestDataFactory, TestFile } from '../fixtures/test-data-factory';

export class DashboardPage extends EnhancedBasePage {
  // ページ固有のロケーター
  private readonly uploadButton = () => this.getByTestId('upload-button');
  private readonly fileList = () => this.getByTestId('file-list');
  private readonly fileRows = () => this.getAllByTestId('file-row');
  private readonly emptyState = () => this.getByTestId('empty-file-list');
  
  constructor(page: Page) {
    super(page);
  }

  // 必須実装: ページ識別子
  getPageIdentifier(): string {
    return 'dashboard';
  }

  // 必須実装: ページロード待機
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForURL('**/dashboard');
    await this.waitForNetworkIdle();
    // ダッシュボード固有の要素を待機
    await this.page.waitForSelector('[data-testid="uploaded-files-title"]');
  }

  // 必須実装: ユーザー価値検証
  async validateUserValue(): Promise<boolean> {
    // ダッシュボードの核心価値：ファイル管理ができること
    const canSeeFileList = await this.fileList().isVisible();
    const canUploadFiles = await this.uploadButton().isEnabled();
    const hasProperLayout = await this.validateLayout();
    
    return canSeeFileList && canUploadFiles && hasProperLayout;
  }

  // ページ固有のメソッド
  async getFileCount(): Promise<number> {
    if (await this.emptyState().isVisible()) {
      return 0;
    }
    return await this.fileRows().count();
  }

  async uploadFile(file?: TestFile): Promise<void> {
    const testFile = file || TestDataFactory.createTestFile();
    this.testFiles.push(testFile);
    
    await this.uploadButton().click();
    await this.page.waitForURL('**/upload');
    // アップロード処理...
  }

  async findFileByName(fileName: string): Promise<Locator | null> {
    const rows = await this.fileRows().all();
    for (const row of rows) {
      const text = await row.textContent();
      if (text?.includes(fileName)) {
        return row;
      }
    }
    return null;
  }

  async deleteFile(fileName: string): Promise<boolean> {
    const fileRow = await this.findFileByName(fileName);
    if (!fileRow) return false;
    
    const deleteButton = fileRow.locator('[data-testid="delete-button"]');
    await deleteButton.click();
    
    // 確認ダイアログ処理
    const confirmButton = this.page.getByTestId('delete-confirm');
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
    }
    
    // ファイルが削除されるまで待機
    await fileRow.waitFor({ state: 'hidden' });
    return true;
  }

  async translateFile(fileName: string): Promise<void> {
    const fileRow = await this.findFileByName(fileName);
    if (!fileRow) throw new Error(`File not found: ${fileName}`);
    
    const translateButton = fileRow.locator('[data-testid="translate-button"]');
    await translateButton.click();
    
    // 翻訳モーダルの処理...
  }

  // レイアウト検証
  private async validateLayout(): Promise<boolean> {
    const header = await this.page.locator('header').isVisible();
    const sidebar = await this.page.locator('[data-testid="sidebar"]').isVisible();
    const mainContent = await this.page.locator('main').isVisible();
    
    return header && mainContent; // sidebarは必須ではない
  }

  // ダッシュボード固有のパフォーマンスメトリクス
  async measureDashboardPerformance(): Promise<{
    fileListRenderTime: number;
    initialLoadTime: number;
  }> {
    const metrics = await this.measurePerformance();
    
    // ファイルリストの描画時間を測定
    const fileListRenderTime = await this.page.evaluate(() => {
      const fileList = document.querySelector('[data-testid="file-list"]');
      if (!fileList) return 0;
      
      const observer = performance.getEntriesByName('file-list-render')[0];
      return observer?.duration || 0;
    });
    
    return {
      fileListRenderTime,
      initialLoadTime: metrics.pageLoadTime
    };
  }
}
```

【実装対象Page Objects】
1. LoginPage - 認証関連
2. DashboardPage - ファイル管理
3. UploadPage - アップロード機能
4. PreviewPage - プレビュー機能
5. AdminPage - 管理者機能
6. ProfilePage - プロフィール管理

各Page Objectで必ず実装：
- getPageIdentifier()
- waitForPageLoad()
- validateUserValue()
- ページ固有の機能メソッド
- TestDataFactory使用
```

---

## Phase 4: UserJourneyヘルパーの全面活用（4時間）

### プロンプト 4.1: 既存テストのUserJourney置換

```
既存のE2Eテストを、UserJourneyHelperを使用した形式に書き換えてください。

【変換パターン】

1. 基本的なログインテスト:
```typescript
// Before: 実装詳細に依存
test('ユーザーログイン', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'Test123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
});

// After: ユーザー価値にフォーカス
test('ユーザーログイン', async ({ page }) => {
  const journey = new UserJourneyHelper(page);
  const loginPage = new LoginPage(page);
  
  // テストユーザー作成
  const testUser = TestDataFactory.createUser();
  
  // ログイン実行
  await loginPage.goto();
  await loginPage.loginWithTestUser(testUser);
  
  // ユーザー価値の検証
  const canAccessDashboard = await loginPage.validateUserCanAccessDashboard();
  expect(canAccessDashboard).toBe(true);
  
  // アクセシビリティ検証
  const a11y = await journey.checkAccessibility();
  expect(a11y.isKeyboardNavigable).toBe(true);
  
  // クリーンアップ
  await journey.cleanupTestData(testUser, []);
});
```

2. ファイルアップロード→翻訳→ダウンロードの完全フロー:
```typescript
// After: UserJourneyHelper使用
test('完全な翻訳フロー', async ({ page }) => {
  const journey = new UserJourneyHelper(page);
  
  // 完全なユーザージャーニーを実行
  const result = await journey.completeFullUserJourney();
  
  // 結果検証
  expect(result.user).toBeDefined();
  expect(result.fileId).toBeTruthy();
  expect(result.downloadPath).toBeTruthy();
  
  // ダウンロードファイルの検証
  const fs = require('fs');
  const fileExists = fs.existsSync(result.downloadPath);
  expect(fileExists).toBe(true);
  
  // パフォーマンス検証
  const perf = await journey.measurePerformance();
  expect(perf.pageLoadTime).toBeLessThan(3000);
  
  // クリーンアップ
  await journey.cleanupTestData(result.user, [result.fileId]);
});
```

3. エラーハンドリングテスト:
```typescript
test('無効なファイル形式のエラーハンドリング', async ({ page }) => {
  const journey = new UserJourneyHelper(page);
  const uploadPage = new UploadPage(page);
  
  // セットアップ
  const user = await journey.registerAndLogin();
  
  // 無効なファイルアップロードを試行
  const invalidFile = TestDataFactory.scenarios.invalidFile();
  const errorIsUserFriendly = await journey.validateErrorMessage(async () => {
    await uploadPage.uploadFile(invalidFile);
  });
  
  // エラーメッセージがユーザーフレンドリーか検証
  expect(errorIsUserFriendly).toBe(true);
  
  // リカバリー可能か検証
  const canRecover = await uploadPage.canRetryUpload();
  expect(canRecover).toBe(true);
});
```

【置換対象ファイル優先順位】
1. e2e/smoke/critical-path.spec.ts
2. e2e/features/upload.spec.ts
3. e2e/features/translation.spec.ts
4. e2e/features/download.spec.ts
5. e2e/core/auth.spec.ts
```

### プロンプト 4.2: 新規テストテンプレートの展開

```
新規テスト作成用のテンプレートファイルと、それを使用した実装例を作成してください。

【テンプレートファイル】
e2e/templates/feature-test.template.ts

```typescript
import { test, expect } from '@playwright/test';
import { TestDataFactory, TestUser } from '../fixtures/test-data-factory';
import { UserJourneyHelper } from '../helpers/user-journey.helper';
// ページオブジェクトのインポート（必要に応じて）
// import { SpecificPage } from '../page-objects/specific.page';

/**
 * Feature: [機能名をここに記載]
 * 
 * Background:
 *   [前提条件をここに記載]
 * 
 * Value Proposition:
 *   [この機能がユーザーに提供する価値を記載]
 */
test.describe('Feature: [機能名]', () => {
  let journey: UserJourneyHelper;
  let testUser: TestUser;
  
  // セットアップ
  test.beforeEach(async ({ page }) => {
    journey = new UserJourneyHelper(page);
    testUser = TestDataFactory.createUser();
    
    // 共通の前準備がある場合はここに
    // await journey.registerAndLogin();
  });
  
  // クリーンアップ
  test.afterEach(async () => {
    // テストデータのクリーンアップ
    if (testUser) {
      await journey.cleanupTestData(testUser, []);
    }
  });
  
  test('Scenario: [シナリオ名] - ユーザー価値の検証', async ({ page }) => {
    // Arrange - 準備
    // TODO: テストに必要なデータやページの準備
    
    // Act - 実行
    // TODO: ユーザーアクションの実行
    
    // Assert - 検証
    // 1. ユーザー価値の検証
    // TODO: 期待される結果の検証
    
    // 2. エラーハンドリングの検証
    const hasUserFriendlyErrors = await journey.validateErrorMessage(async () => {
      // エラーを発生させる操作
    });
    expect(hasUserFriendlyErrors).toBe(true);
    
    // 3. アクセシビリティの検証
    const a11y = await journey.checkAccessibility();
    expect(a11y).toMatchObject({
      hasAltText: true,
      hasAriaLabels: true,
      hasProperHeadings: true,
      isKeyboardNavigable: true
    });
    
    // 4. パフォーマンスの検証（必要に応じて）
    const performance = await journey.measurePerformance();
    expect(performance.pageLoadTime).toBeLessThan(3000);
  });
  
  test('Scenario: [エラーケース] - 異常系の検証', async ({ page }) => {
    // 異常系のテストケース
    // TODO: エラーケースの実装
  });
  
  test.skip('Scenario: [将来の機能] - 未実装', async ({ page }) => {
    // まだ実装されていない機能のプレースホルダー
  });
});
```

【実装例】
e2e/features/batch-translation.spec.ts

```typescript
import { test, expect } from '@playwright/test';
import { TestDataFactory, TestUser, TestFile } from '../fixtures/test-data-factory';
import { UserJourneyHelper } from '../helpers/user-journey.helper';
import { DashboardPage } from '../page-objects/dashboard.page';
import { UploadPage } from '../page-objects/upload.page';

/**
 * Feature: バッチ翻訳機能
 * 
 * Background:
 *   ユーザーがログイン済みである
 *   複数のPPTXファイルを持っている
 * 
 * Value Proposition:
 *   複数のファイルを一括で翻訳することで時間を節約できる
 */
test.describe('Feature: バッチ翻訳', () => {
  let journey: UserJourneyHelper;
  let testUser: TestUser;
  let testFiles: TestFile[];
  let uploadedFileIds: string[];
  
  test.beforeEach(async ({ page }) => {
    journey = new UserJourneyHelper(page);
    testUser = await journey.registerAndLogin();
    testFiles = Array.from({ length: 3 }, () => TestDataFactory.createTestFile());
    uploadedFileIds = [];
  });
  
  test.afterEach(async () => {
    await journey.cleanupTestData(testUser, uploadedFileIds);
  });
  
  test('Scenario: 複数ファイルの一括翻訳 - 成功パス', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const uploadPage = new UploadPage(page);
    
    // Arrange - 複数ファイルをアップロード
    for (const file of testFiles) {
      const fileId = await journey.uploadFileSuccessfully(file.path);
      uploadedFileIds.push(fileId);
    }
    
    // Act - バッチ翻訳を実行
    await dashboardPage.selectMultipleFiles(uploadedFileIds);
    await dashboardPage.startBatchTranslation('en');
    
    // Assert - 全ファイルが翻訳されたことを確認
    for (const fileId of uploadedFileIds) {
      const isTranslated = await dashboardPage.isFileTranslated(fileId);
      expect(isTranslated).toBe(true);
    }
    
    // パフォーマンス検証 - バッチ処理の効率性
    const performance = await journey.measurePerformance();
    const timePerFile = performance.pageLoadTime / testFiles.length;
    expect(timePerFile).toBeLessThan(2000); // 1ファイルあたり2秒以内
  });
  
  test('Scenario: 一部ファイルの翻訳失敗 - エラーリカバリー', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Arrange - 正常ファイルと異常ファイルを混在
    const normalFile = TestDataFactory.createTestFile();
    const largeFile = TestDataFactory.scenarios.largeFile(); // 失敗する可能性
    
    const normalId = await journey.uploadFileSuccessfully(normalFile.path);
    const largeId = await journey.uploadFileSuccessfully(largeFile.path);
    uploadedFileIds.push(normalId, largeId);
    
    // Act - バッチ翻訳を実行
    await dashboardPage.selectMultipleFiles([normalId, largeId]);
    await dashboardPage.startBatchTranslation('en');
    
    // Assert - 部分的な成功とエラーハンドリング
    const normalTranslated = await dashboardPage.isFileTranslated(normalId);
    const largeTranslated = await dashboardPage.isFileTranslated(largeId);
    
    expect(normalTranslated).toBe(true);
    // 大きいファイルは失敗またはタイムアウトの可能性
    
    // エラーメッセージがユーザーフレンドリーか
    if (!largeTranslated) {
      const hasUserFriendlyError = await dashboardPage.validateErrorMessage();
      expect(hasUserFriendlyError).toBe(true);
      
      // リトライオプションが提供されているか
      const canRetry = await dashboardPage.canRetryTranslation(largeId);
      expect(canRetry).toBe(true);
    }
  });
});
```
```

---

## Phase 5: CI/CD統合（4時間）

### プロンプト 5.1: GitHub Actions設定

```
GitHub ActionsでE2Eテストの品質を自動チェックするワークフローを設定してください。

【ファイルパス】
.github/workflows/e2e-quality-assurance.yml

```yaml
name: E2E Test Quality Assurance

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'e2e/**'
      - 'src/**'
      - 'package.json'
      - 'playwright.config.ts'
  push:
    branches: [main, develop]
  schedule:
    # 毎日午前2時に実行（タイムゾーン: UTC）
    - cron: '0 2 * * *'

env:
  NODE_VERSION: '18'
  PLAYWRIGHT_BROWSERS_PATH: ${{ github.workspace }}/pw-browsers

jobs:
  # Job 1: ハードコードチェック
  hardcoded-check:
    name: Check Hardcoded Test Data
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for hardcoded values
        id: hardcoded
        run: |
          echo "Checking for hardcoded test data..."
          HARDCODED=$(grep -r "test@example\.com\|Test123\|Admin123\|password123" e2e/ --include="*.ts" --include="*.js" | grep -v "test-data-factory" || true)
          
          if [ ! -z "$HARDCODED" ]; then
            echo "❌ Hardcoded test data detected:"
            echo "$HARDCODED"
            echo "hardcoded_found=true" >> $GITHUB_OUTPUT
            exit 1
          else
            echo "✅ No hardcoded test data found"
            echo "hardcoded_found=false" >> $GITHUB_OUTPUT
          fi
      
      - name: Comment PR with hardcoded data
        if: failure() && github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const output = `
            ⚠️ **Hardcoded Test Data Detected**
            
            Please use TestDataFactory instead of hardcoded values.
            
            Run \`npm run migrate:test-data\` to automatically fix these issues.
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: output
            });

  # Job 2: コード品質チェック
  code-quality:
    name: Code Quality Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: |
          npm run lint:e2e -- --format json --output-file eslint-report.json || true
          npm run lint:e2e -- --format stylish
      
      - name: Upload ESLint report
        uses: actions/upload-artifact@v3
        with:
          name: eslint-report
          path: eslint-report.json
      
      - name: TypeScript type check
        run: npm run type-check
      
      - name: Check TestDataFactory usage
        run: |
          echo "Checking TestDataFactory adoption..."
          TOTAL=$(find e2e -name "*.spec.ts" -o -name "*.test.ts" | wc -l)
          USING_FACTORY=$(grep -l "TestDataFactory" e2e/**/*.{spec,test}.ts 2>/dev/null | wc -l)
          PERCENTAGE=$((USING_FACTORY * 100 / TOTAL))
          
          echo "TestDataFactory adoption: $PERCENTAGE% ($USING_FACTORY/$TOTAL files)"
          
          if [ $PERCENTAGE -lt 80 ]; then
            echo "⚠️ Warning: TestDataFactory adoption is below 80%"
            exit 1
          fi

  # Job 3: E2Eテスト実行
  e2e-tests:
    name: Run E2E Tests
    runs-on: ubuntu-latest
    needs: [hardcoded-check, code-quality]
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
        
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Cache Playwright browsers
        uses: actions/cache@v3
        with:
          path: ${{ env.PLAYWRIGHT_BROWSERS_PATH }}
          key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      
      - name: Run E2E tests (Shard ${{ matrix.shard }}/4)
        run: |
          npm run test:e2e -- --shard=${{ matrix.shard }}/4 --reporter=json --reporter=html
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          BASE_URL: ${{ secrets.BASE_URL || 'http://localhost:3000' }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-shard-${{ matrix.shard }}
          path: playwright-report/
          retention-days: 30

  # Job 4: テストレポート統合
  test-report:
    name: Merge Test Reports
    runs-on: ubuntu-latest
    needs: e2e-tests
    if: always()
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Download all test results
        uses: actions/download-artifact@v3
        with:
          path: all-reports/
      
      - name: Merge test reports
        run: |
          npm ci
          npx playwright merge-reports --reporter=html ./all-reports/playwright-report-shard-*
      
      - name: Upload merged report
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report-merged
          path: playwright-report/
      
      - name: Generate quality metrics
        run: |
          node scripts/test-quality-report.js > quality-report.json
          
      - name: Comment PR with test results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('quality-report.json', 'utf8'));
            
            const comment = `
            ## 📊 E2E Test Quality Report
            
            | Metric | Value | Status |
            |--------|-------|--------|
            | TestDataFactory Adoption | ${report.adoptionRate}% | ${report.adoptionRate >= 80 ? '✅' : '⚠️'} |
            | Hardcoded Data | ${report.hardcodedCount} files | ${report.hardcodedCount === 0 ? '✅' : '❌'} |
            | Test Coverage | ${report.coverage}% | ${report.coverage >= 80 ? '✅' : '⚠️'} |
            | Passing Tests | ${report.passRate}% | ${report.passRate >= 95 ? '✅' : '⚠️'} |
            | Avg Execution Time | ${report.avgTime}s | ${report.avgTime < 5 ? '✅' : '⚠️'} |
            
            [View Full Report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

  # Job 5: パフォーマンステスト
  performance-test:
    name: Performance Testing
    runs-on: ubuntu-latest
    needs: [hardcoded-check, code-quality]
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: |
          npm run test:performance
          
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/
```
```

### プロンプト 5.2: 品質ゲートの実装

```
プルリクエストマージ前の品質ゲートを実装してください。

【ファイル】
.github/workflows/quality-gates.yml

```yaml
name: Quality Gates

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  quality-gates:
    name: Quality Gate Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0 # Full history for comparisons
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      # Gate 1: No hardcoded test data
      - name: Gate 1 - No Hardcoded Data
        id: gate1
        run: |
          echo "🔍 Checking for hardcoded test data..."
          if grep -r "test@example\.com\|Test123\|Admin123" e2e/ --include="*.ts" | grep -v "test-data-factory"; then
            echo "gate1_passed=false" >> $GITHUB_OUTPUT
            echo "❌ Gate 1 FAILED: Hardcoded test data found"
            exit 1
          else
            echo "gate1_passed=true" >> $GITHUB_OUTPUT
            echo "✅ Gate 1 PASSED: No hardcoded test data"
          fi
      
      # Gate 2: TestDataFactory adoption > 90%
      - name: Gate 2 - TestDataFactory Adoption
        id: gate2
        run: |
          echo "📊 Checking TestDataFactory adoption..."
          TOTAL=$(find e2e -name "*.spec.ts" -o -name "*.test.ts" | wc -l)
          USING=$(grep -l "TestDataFactory" e2e/**/*.{spec,test}.ts 2>/dev/null | wc -l)
          PERCENTAGE=$((USING * 100 / TOTAL))
          
          if [ $PERCENTAGE -lt 90 ]; then
            echo "gate2_passed=false" >> $GITHUB_OUTPUT
            echo "❌ Gate 2 FAILED: TestDataFactory adoption is $PERCENTAGE% (required: 90%)"
            exit 1
          else
            echo "gate2_passed=true" >> $GITHUB_OUTPUT
            echo "✅ Gate 2 PASSED: TestDataFactory adoption is $PERCENTAGE%"
          fi
      
      # Gate 3: No new ESLint errors
      - name: Gate 3 - ESLint Clean
        id: gate3
        run: |
          echo "🔧 Checking ESLint..."
          if ! npm run lint:e2e; then
            echo "gate3_passed=false" >> $GITHUB_OUTPUT
            echo "❌ Gate 3 FAILED: ESLint errors found"
            exit 1
          else
            echo "gate3_passed=true" >> $GITHUB_OUTPUT
            echo "✅ Gate 3 PASSED: No ESLint errors"
          fi
      
      # Gate 4: TypeScript compilation
      - name: Gate 4 - TypeScript Compilation
        id: gate4
        run: |
          echo "📝 Checking TypeScript..."
          if ! npm run type-check; then
            echo "gate4_passed=false" >> $GITHUB_OUTPUT
            echo "❌ Gate 4 FAILED: TypeScript errors found"
            exit 1
          else
            echo "gate4_passed=true" >> $GITHUB_OUTPUT
            echo "✅ Gate 4 PASSED: TypeScript compilation successful"
          fi
      
      # Gate 5: Test coverage > 80%
      - name: Gate 5 - Test Coverage
        id: gate5
        run: |
          echo "📈 Checking test coverage..."
          npm run test:coverage -- --silent
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "gate5_passed=false" >> $GITHUB_OUTPUT
            echo "❌ Gate 5 FAILED: Coverage is $COVERAGE% (required: 80%)"
            exit 1
          else
            echo "gate5_passed=true" >> $GITHUB_OUTPUT
            echo "✅ Gate 5 PASSED: Coverage is $COVERAGE%"
          fi
      
      # Final Report
      - name: Quality Gate Summary
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const gates = {
              'No Hardcoded Data': '${{ steps.gate1.outputs.gate1_passed }}' === 'true',
              'TestDataFactory Adoption (>90%)': '${{ steps.gate2.outputs.gate2_passed }}' === 'true',
              'ESLint Clean': '${{ steps.gate3.outputs.gate3_passed }}' === 'true',
              'TypeScript Compilation': '${{ steps.gate4.outputs.gate4_passed }}' === 'true',
              'Test Coverage (>80%)': '${{ steps.gate5.outputs.gate5_passed }}' === 'true'
            };
            
            const allPassed = Object.values(gates).every(v => v);
            const emoji = allPassed ? '✅' : '❌';
            const status = allPassed ? 'PASSED' : 'FAILED';
            
            let body = `## ${emoji} Quality Gates: ${status}\n\n`;
            body += '| Gate | Status |\n';
            body += '|------|--------|\n';
            
            for (const [gate, passed] of Object.entries(gates)) {
              body += `| ${gate} | ${passed ? '✅ Passed' : '❌ Failed'} |\n`;
            }
            
            if (!allPassed) {
              body += '\n### 🛠️ Required Actions\n';
              body += '1. Run `npm run migrate:test-data` to fix hardcoded data\n';
              body += '2. Run `npm run lint:e2e -- --fix` to fix linting issues\n';
              body += '3. Fix TypeScript errors shown above\n';
              body += '4. Increase test coverage for changed files\n';
            }
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });

  # ブランチ保護ルール設定の推奨
  protection-rules:
    name: Branch Protection Recommendations
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request' && github.base_ref == 'main'
    steps:
      - name: Recommend protection rules
        uses: actions/github-script@v6
        with:
          script: |
            const comment = `
            ### 🔒 Recommended Branch Protection Rules
            
            To enforce quality gates, configure these branch protection rules for \`main\`:
            
            **Required status checks:**
            - quality-gates
            - hardcoded-check
            - code-quality
            - e2e-tests
            
            **Additional settings:**
            - Require branches to be up to date before merging
            - Require conversation resolution before merging
            - Dismiss stale pull request approvals when new commits are pushed
            - Include administrators
            
            [Configure Branch Protection](https://github.com/${{ github.repository }}/settings/branches)
            `;
            
            // Only comment once per PR
            const comments = await github.rest.issues.listComments({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo
            });
            
            const hasComment = comments.data.some(c => 
              c.body.includes('Recommended Branch Protection Rules')
            );
            
            if (!hasComment) {
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
```
```

---

## Phase 6: 監視とメトリクス（2時間）

### プロンプト 6.1: リアルタイムダッシュボード実装

```
テスト品質をリアルタイムで監視するダッシュボードを実装してください。

【ファイル】
scripts/quality-dashboard-server.ts

```typescript
#!/usr/bin/env ts-node

import express from 'express';
import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import chokidar from 'chokidar';
import WebSocket from 'ws';

interface QualityMetrics {
  timestamp: Date;
  totalFiles: number;
  filesUsingTestDataFactory: number;
  filesWithHardcodedData: number;
  filesWithPageObject: number;
  filesWithUserJourney: number;
  coveragePercentage: number;
  testExecutionTime: number;
  passRate: number;
  flakyTests: string[];
  recentChanges: FileChange[];
}

interface FileChange {
  file: string;
  changeType: 'added' | 'modified' | 'deleted';
  timestamp: Date;
  issues: string[];
}

class QualityDashboardServer {
  private app: express.Application;
  private wss: WebSocket.Server;
  private metrics: QualityMetrics;
  private fileWatcher: chokidar.FSWatcher;

  constructor() {
    this.app = express();
    this.wss = new WebSocket.Server({ port: 8081 });
    this.metrics = this.initializeMetrics();
    
    this.setupServer();
    this.setupWebSocket();
    this.setupFileWatcher();
  }

  private initializeMetrics(): QualityMetrics {
    return {
      timestamp: new Date(),
      totalFiles: 0,
      filesUsingTestDataFactory: 0,
      filesWithHardcodedData: 0,
      filesWithPageObject: 0,
      filesWithUserJourney: 0,
      coveragePercentage: 0,
      testExecutionTime: 0,
      passRate: 0,
      flakyTests: [],
      recentChanges: []
    };
  }

  private setupServer(): void {
    this.app.use(express.static('public'));
    
    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.metrics);
    });

    this.app.get('/api/metrics/history', (req, res) => {
      // Load historical data from file
      const historyFile = 'quality-metrics-history.json';
      if (fs.existsSync(historyFile)) {
        const history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        res.json(history);
      } else {
        res.json([]);
      }
    });

    this.app.get('/api/files/issues', (req, res) => {
      const issues = this.scanForIssues();
      res.json(issues);
    });

    // Serve dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.generateDashboardHTML());
    });

    this.app.listen(8080, () => {
      console.log('📊 Quality Dashboard running at http://localhost:8080');
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket connection');
      
      // Send initial metrics
      ws.send(JSON.stringify({
        type: 'metrics',
        data: this.metrics
      }));

      // Send updates every 5 seconds
      const interval = setInterval(() => {
        this.updateMetrics();
        ws.send(JSON.stringify({
          type: 'metrics',
          data: this.metrics
        }));
      }, 5000);

      ws.on('close', () => {
        clearInterval(interval);
      });
    });
  }

  private setupFileWatcher(): void {
    this.fileWatcher = chokidar.watch('e2e/**/*.{ts,js}', {
      ignored: /node_modules/,
      persistent: true
    });

    this.fileWatcher
      .on('add', (path) => this.handleFileChange(path, 'added'))
      .on('change', (path) => this.handleFileChange(path, 'modified'))
      .on('unlink', (path) => this.handleFileChange(path, 'deleted'));
  }

  private handleFileChange(filePath: string, changeType: 'added' | 'modified' | 'deleted'): void {
    const issues = this.analyzeFile(filePath);
    
    const change: FileChange = {
      file: filePath,
      changeType,
      timestamp: new Date(),
      issues
    };

    // Add to recent changes (keep last 20)
    this.metrics.recentChanges.unshift(change);
    if (this.metrics.recentChanges.length > 20) {
      this.metrics.recentChanges.pop();
    }

    // Broadcast change to all connected clients
    this.broadcast({
      type: 'fileChange',
      data: change
    });

    // Update metrics
    this.updateMetrics();
  }

  private analyzeFile(filePath: string): string[] {
    const issues: string[] = [];
    
    if (!fs.existsSync(filePath)) {
      return issues;
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check for hardcoded data
    if (/test@example\.com|Test123|Admin123/.test(content)) {
      issues.push('Contains hardcoded test data');
    }

    // Check for TestDataFactory usage
    if (!content.includes('TestDataFactory')) {
      issues.push('Not using TestDataFactory');
    }

    // Check for Page Object pattern
    if (filePath.includes('.spec.ts') && !content.includes('Page')) {
      issues.push('Not using Page Object pattern');
    }

    // Check for proper assertions
    if (!content.includes('expect')) {
      issues.push('No assertions found');
    }

    // Check for error handling
    if (!content.includes('try') && !content.includes('catch')) {
      issues.push('No error handling');
    }

    return issues;
  }

  private updateMetrics(): void {
    const testFiles = glob.sync('e2e/**/*.{spec,test}.ts');
    
    this.metrics.timestamp = new Date();
    this.metrics.totalFiles = testFiles.length;
    this.metrics.filesUsingTestDataFactory = 0;
    this.metrics.filesWithHardcodedData = 0;
    this.metrics.filesWithPageObject = 0;
    this.metrics.filesWithUserJourney = 0;

    for (const file of testFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      if (content.includes('TestDataFactory')) {
        this.metrics.filesUsingTestDataFactory++;
      }
      
      if (/test@example\.com|Test123|Admin123/.test(content)) {
        this.metrics.filesWithHardcodedData++;
      }
      
      if (/extends.*Page|new.*Page/.test(content)) {
        this.metrics.filesWithPageObject++;
      }
      
      if (content.includes('UserJourneyHelper')) {
        this.metrics.filesWithUserJourney++;
      }
    }

    // Load coverage if available
    if (fs.existsSync('coverage/coverage-summary.json')) {
      const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf-8'));
      this.metrics.coveragePercentage = coverage.total.lines.pct;
    }

    // Load test results if available
    if (fs.existsSync('test-results/results.json')) {
      const results = JSON.parse(fs.readFileSync('test-results/results.json', 'utf-8'));
      this.metrics.passRate = (results.passed / results.total) * 100;
      this.metrics.testExecutionTime = results.duration;
      this.metrics.flakyTests = results.flaky || [];
    }

    // Save metrics to history
    this.saveMetricsToHistory();
  }

  private saveMetricsToHistory(): void {
    const historyFile = 'quality-metrics-history.json';
    let history = [];
    
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    }
    
    history.push(this.metrics);
    
    // Keep last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }
    
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  }

  private scanForIssues(): any {
    const testFiles = glob.sync('e2e/**/*.{spec,test}.ts');
    const fileIssues: { [key: string]: string[] } = {};

    for (const file of testFiles) {
      const issues = this.analyzeFile(file);
      if (issues.length > 0) {
        fileIssues[file] = issues;
      }
    }

    return fileIssues;
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E2E Test Quality Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            position: relative;
            overflow: hidden;
        }
        .metric-value {
            font-size: 48px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .metric-trend {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 24px;
        }
        .good { color: #10b981; }
        .warning { color: #f59e0b; }
        .bad { color: #ef4444; }
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .recent-changes {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .change-item {
            padding: 15px;
            border-left: 4px solid #667eea;
            margin-bottom: 15px;
            background: #f9fafb;
            border-radius: 5px;
        }
        .live-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
            animation: pulse 2s infinite;
            margin-right: 10px;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <span class="live-indicator"></span>
                E2E Test Quality Dashboard
            </h1>
            <p style="margin-top: 10px; color: #666;">
                リアルタイム品質メトリクス監視
            </p>
        </div>

        <div class="metrics-grid" id="metrics-grid">
            <!-- Metrics cards will be inserted here -->
        </div>

        <div class="chart-container">
            <h2>Adoption Trend</h2>
            <canvas id="trend-chart"></canvas>
        </div>

        <div class="recent-changes">
            <h2>Recent Changes</h2>
            <div id="changes-list">
                <!-- Recent changes will be inserted here -->
            </div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:8081');
        let trendChart;

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            if (message.type === 'metrics') {
                updateMetrics(message.data);
            } else if (message.type === 'fileChange') {
                addRecentChange(message.data);
            }
        };

        function updateMetrics(metrics) {
            const adoptionRate = ((metrics.filesUsingTestDataFactory / metrics.totalFiles) * 100).toFixed(1);
            const hardcodedRate = ((metrics.filesWithHardcodedData / metrics.totalFiles) * 100).toFixed(1);
            
            const metricsHTML = \`
                <div class="metric-card">
                    <div class="metric-label">TestDataFactory Adoption</div>
                    <div class="metric-value \${adoptionRate >= 80 ? 'good' : adoptionRate >= 50 ? 'warning' : 'bad'}">
                        \${adoptionRate}%
                    </div>
                    <div class="metric-trend \${adoptionRate >= 80 ? 'good' : 'warning'}">↑</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Hardcoded Data</div>
                    <div class="metric-value \${hardcodedRate < 10 ? 'good' : hardcodedRate < 30 ? 'warning' : 'bad'}">
                        \${metrics.filesWithHardcodedData}
                    </div>
                    <div class="metric-trend \${hardcodedRate < 10 ? 'good' : 'bad'}">↓</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Test Coverage</div>
                    <div class="metric-value \${metrics.coveragePercentage >= 80 ? 'good' : metrics.coveragePercentage >= 60 ? 'warning' : 'bad'}">
                        \${metrics.coveragePercentage.toFixed(1)}%
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Pass Rate</div>
                    <div class="metric-value \${metrics.passRate >= 95 ? 'good' : metrics.passRate >= 80 ? 'warning' : 'bad'}">
                        \${metrics.passRate.toFixed(1)}%
                    </div>
                </div>
            \`;
            
            document.getElementById('metrics-grid').innerHTML = metricsHTML;
        }

        function addRecentChange(change) {
            const changeHTML = \`
                <div class="change-item">
                    <strong>\${change.file}</strong> - \${change.changeType}
                    <br>
                    <small>\${new Date(change.timestamp).toLocaleString()}</small>
                    \${change.issues.length > 0 ? '<br>Issues: ' + change.issues.join(', ') : ''}
                </div>
            \`;
            
            const changesList = document.getElementById('changes-list');
            changesList.insertAdjacentHTML('afterbegin', changeHTML);
            
            // Keep only last 10 changes
            while (changesList.children.length > 10) {
                changesList.removeChild(changesList.lastChild);
            }
        }

        // Initialize trend chart
        const ctx = document.getElementById('trend-chart').getContext('2d');
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'TestDataFactory Adoption %',
                    data: [],
                    borderColor: '#667eea',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });

        // Fetch initial metrics
        fetch('/api/metrics')
            .then(res => res.json())
            .then(metrics => updateMetrics(metrics));
    </script>
</body>
</html>
    `;
  }
}

// Start the dashboard server
new QualityDashboardServer();
```

【実行方法】
```bash
# ダッシュボードサーバー起動
npm run dashboard:start

# ブラウザで開く
open http://localhost:8080
```
```

---

## Phase 7: チーム移行とトレーニング（4時間）

### プロンプト 7.1: 開発者向けガイドライン作成

```
開発チーム向けの包括的なテストガイドラインドキュメントを作成してください。

【ファイル】
docs/E2E_TEST_GUIDELINES.md

```markdown
# E2E Test Guidelines - 開発者ガイド

## 📚 目次
1. [はじめに](#はじめに)
2. [必須ルール](#必須ルール)
3. [テストの書き方](#テストの書き方)
4. [よくある間違いと修正方法](#よくある間違いと修正方法)
5. [ツールとヘルパー](#ツールとヘルパー)
6. [チェックリスト](#チェックリスト)
7. [FAQ](#faq)

## はじめに

このガイドは、E2Eテストを書く際の標準的な方法を定義しています。
**全ての開発者は、このガイドラインに従ってテストを書く必要があります。**

### なぜこのガイドラインが必要か？

- **一貫性**: チーム全体で同じパターンを使用
- **保守性**: テストの修正と更新が容易
- **信頼性**: Flakyテストの削減
- **効率性**: 再利用可能なコンポーネント

## 必須ルール

### ❌ 絶対にやってはいけないこと

```typescript
// ❌ BAD: ハードコードされたテストデータ
const user = {
  email: 'test@example.com',
  password: 'Test123'
};

// ❌ BAD: セレクタの直接使用
await page.click('.btn-primary');
await page.fill('#email-input', 'test@example.com');

// ❌ BAD: 実装詳細のテスト
expect(button).toHaveClass('btn-primary');

// ❌ BAD: エラーハンドリングなし
await page.click('button');
// エラーが起きたらテスト失敗
```

### ✅ 必ずやるべきこと

```typescript
// ✅ GOOD: TestDataFactoryを使用
const user = TestDataFactory.createUser();

// ✅ GOOD: data-testid属性を使用
await page.getByTestId('submit-button').click();

// ✅ GOOD: Page Objectパターン
const loginPage = new LoginPage(page);
await loginPage.login(user.email, user.password);

// ✅ GOOD: ユーザー価値の検証
const canAccessDashboard = await loginPage.validateUserCanAccessDashboard();
expect(canAccessDashboard).toBe(true);

// ✅ GOOD: エラーハンドリング
try {
  await page.click('button');
} catch (error) {
  console.error('Button click failed:', error);
  throw new Error(`Failed to click button: ${error.message}`);
}
```

## テストの書き方

### 1. 新しいテストファイルの作成

```typescript
// e2e/features/your-feature.spec.ts

import { test, expect } from '@playwright/test';
import { TestDataFactory, TestUser } from '../fixtures/test-data-factory';
import { UserJourneyHelper } from '../helpers/user-journey.helper';
import { YourPage } from '../page-objects/your.page';

test.describe('Feature: あなたの機能', () => {
  let journey: UserJourneyHelper;
  let testUser: TestUser;
  let page: YourPage;

  test.beforeEach(async ({ page: playwrightPage }) => {
    // 初期化
    journey = new UserJourneyHelper(playwrightPage);
    testUser = TestDataFactory.createUser();
    page = new YourPage(playwrightPage);
    
    // ログイン（必要な場合）
    await journey.registerAndLogin();
  });

  test.afterEach(async () => {
    // クリーンアップ
    await journey.cleanupTestData(testUser, []);
  });

  test('ユーザーストーリー: ユーザーが○○できる', async () => {
    // Arrange - 準備
    const testData = TestDataFactory.createTestFile();
    
    // Act - 実行
    await page.performAction(testData);
    
    // Assert - 検証
    const result = await page.validateUserValue();
    expect(result).toBe(true);
    
    // アクセシビリティチェック
    const a11y = await journey.checkAccessibility();
    expect(a11y.isKeyboardNavigable).toBe(true);
  });
});
```

### 2. Page Objectの作成

```typescript
// e2e/page-objects/your.page.ts

import { Page } from '@playwright/test';
import { EnhancedBasePage } from './base-enhanced.page';
import { TestDataFactory } from '../fixtures/test-data-factory';

export class YourPage extends EnhancedBasePage {
  // ロケーター定義（data-testid使用）
  private readonly submitButton = () => this.getByTestId('submit-button');
  private readonly emailInput = () => this.getByTestId('email-input');
  
  // 必須メソッド実装
  getPageIdentifier(): string {
    return 'your-page';
  }
  
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForURL('**/your-page');
    await this.waitForNetworkIdle();
  }
  
  async validateUserValue(): Promise<boolean> {
    // この機能がユーザーに提供する価値を検証
    const canPerformAction = await this.submitButton().isEnabled();
    const hasRequiredElements = await this.emailInput().isVisible();
    return canPerformAction && hasRequiredElements;
  }
  
  // ページ固有のアクション
  async performAction(data: any): Promise<void> {
    await this.emailInput().fill(data.email);
    await this.submitButton().click();
  }
}
```

### 3. テストデータの生成

```typescript
// 基本的なユーザー
const user = TestDataFactory.createUser();

// 管理者ユーザー
const admin = TestDataFactory.createAdminUser();

// カスタムユーザー
const customUser = TestDataFactory.createUser({
  email: `custom.${Date.now()}@testdomain.local`,
  role: 'ADMIN'
});

// ファイルデータ
const file = TestDataFactory.createTestFile();

// エラーケース用データ
const invalidUser = TestDataFactory.scenarios.invalidEmailUser();
const xssAttempt = TestDataFactory.scenarios.xssUser();
```

## よくある間違いと修正方法

### 間違い1: ハードコードされたセレクタ

```typescript
// ❌ BAD
await page.click('.submit-btn');
await page.click('#submit');
await page.click('button[type="submit"]');

// ✅ GOOD
await page.getByTestId('submit-button').click();
await page.getByRole('button', { name: 'Submit' }).click();
```

### 間違い2: 同期的な待機

```typescript
// ❌ BAD
await page.waitForTimeout(5000); // 固定時間待機

// ✅ GOOD
await page.waitForSelector('[data-testid="loaded"]');
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 5000 });
```

### 間違い3: テストの独立性がない

```typescript
// ❌ BAD
test('test 1', async () => {
  // グローバル変数を設定
  global.userId = '123';
});

test('test 2', async () => {
  // test 1に依存
  const userId = global.userId;
});

// ✅ GOOD
test('test 1', async () => {
  const user = TestDataFactory.createUser();
  // ローカルスコープで完結
});

test('test 2', async () => {
  const user = TestDataFactory.createUser();
  // 独立して実行可能
});
```

## ツールとヘルパー

### 利用可能なコマンド

```bash
# テストデータの移行
npm run migrate:test-data

# ハードコードチェック
npm run validate:no-hardcode

# E2Eテスト実行
npm run test:e2e

# 特定のファイルのみテスト
npm run test:e2e -- e2e/features/your-feature.spec.ts

# デバッグモード
npm run test:e2e -- --debug

# UIモードで実行
npm run test:e2e -- --ui
```

### VS Code拡張機能

推奨する拡張機能：
- Playwright Test for VSCode
- ESLint
- Prettier
- GitLens

### デバッグテクニック

```typescript
// スクリーンショット撮影
await page.screenshot({ path: 'debug.png' });

// ブラウザを開いたままにする
await page.pause();

// コンソールログ出力
page.on('console', msg => console.log(msg.text()));

// ネットワークログ
page.on('request', request => console.log('Request:', request.url()));
page.on('response', response => console.log('Response:', response.url()));
```

## チェックリスト

### 新しいテストを書く前に

- [ ] TestDataFactoryをインポートしたか？
- [ ] Page Objectを作成/使用しているか？
- [ ] data-testid属性が利用可能か確認したか？
- [ ] エラーケースを考慮したか？
- [ ] クリーンアップを実装したか？

### テストを書いた後

- [ ] `npm run lint:e2e`でエラーがないか？
- [ ] `npm run validate:no-hardcode`でハードコードがないか？
- [ ] テストが独立して実行できるか？
- [ ] CI/CDでグリーンになるか？

### レビュー時のチェックポイント

- [ ] TestDataFactoryを使用しているか？
- [ ] Page Objectパターンに従っているか？
- [ ] ユーザー価値を検証しているか？
- [ ] エラーハンドリングが適切か？
- [ ] アクセシビリティを考慮しているか？

## FAQ

### Q: なぜハードコードがダメなのか？

A: ハードコードされたデータは以下の問題を引き起こします：
- 本番環境のデータと衝突する可能性
- テスト間でデータが競合する
- データの変更が困難
- セキュリティリスク

### Q: Page Objectパターンとは？

A: UIの要素と操作をカプセル化するデザインパターンです。
利点：
- UIの変更に強い
- コードの再利用性
- テストの可読性向上

### Q: TestDataFactoryの使い方は？

A: 以下のように使用します：
```typescript
// ユーザー作成
const user = TestDataFactory.createUser();

// ファイル作成
const file = TestDataFactory.createTestFile();

// 複数ユーザー
const users = TestDataFactory.createUsers(5);
```

### Q: テストが不安定（Flaky）な場合は？

A: 以下を確認してください：
1. 固定のwaitForTimeoutを使っていないか
2. ネットワーク依存を適切に待機しているか
3. テストデータが他のテストと競合していないか
4. リトライメカニズムを実装しているか

### Q: デバッグ方法は？

A: 以下の方法があります：
```bash
# ヘッドフルモードで実行
npm run test:e2e -- --headed

# デバッグモード
npm run test:e2e -- --debug

# 特定のテストのみ
npm run test:e2e -- --grep "your test name"
```

## サポート

質問がある場合は：
1. このガイドラインを確認
2. 既存のテストコードを参考にする
3. チームのSlackチャンネルで質問
4. PRレビューでフィードバックを受ける

---

*このガイドラインは定期的に更新されます。最新版を常に参照してください。*
```
```

### プロンプト 7.2: 移行完了チェックリスト

```
テスト改善の移行が完了したことを確認するための最終チェックリストを作成してください。

【ファイル】
MIGRATION_COMPLETION_CHECKLIST.md

```markdown
# テスト改善移行完了チェックリスト

## 📋 Phase 1: 基盤整備とツール準備 ✅

### 完了項目
- [ ] `scripts/migrate-test-data.ts` 作成完了
- [ ] `eslint-rules/no-hardcoded-test-data.js` 実装完了
- [ ] `.husky/pre-commit` フック設定完了
- [ ] `scripts/backup-manager.ts` 実装完了
- [ ] バックアップ作成（移行前の状態保存）

### 検証コマンド
```bash
# 移行スクリプトの動作確認
npm run migrate:test-data -- --dry-run

# ESLintルールの動作確認
npm run lint:e2e

# pre-commitフックの動作確認
git commit --dry-run
```

## 📋 Phase 2: 全テストファイルへの一括適用 ✅

### Critical Priority（10ファイル）
- [ ] `e2e/core/auth.spec.ts`
- [ ] `e2e/core/csrf-protection.spec.ts`
- [ ] `e2e/core/auth-flow-stable.spec.ts`
- [ ] `e2e/core/admin-login.spec.ts`
- [ ] `e2e/critical-user-journey.spec.ts`
- [ ] `e2e/config/test-config.ts`
- [ ] `e2e/mocks/handlers.ts`
- [ ] `e2e/auth/setup-auth.ts`
- [ ] `e2e/fixtures/global-setup.ts`
- [ ] `e2e/fixtures/test-base.ts`

### High Priority（20ファイル）
- [ ] すべての`e2e/features/*.spec.ts`
- [ ] すべての`e2e/page-objects/*.page.ts`
- [ ] すべての`e2e/helpers/*.helper.ts`

### Medium Priority（29ファイル）
- [ ] すべての`e2e/api/*.spec.ts`
- [ ] すべての`e2e/security/*.spec.ts`
- [ ] すべての`e2e/performance/*.spec.ts`
- [ ] その他のテストファイル

### 検証コマンド
```bash
# ハードコードが残っていないことを確認
npm run validate:no-hardcode

# 各カテゴリのテスト実行
npm run test:e2e -- e2e/core
npm run test:e2e -- e2e/features
npm run test:e2e -- e2e/api
```

## 📋 Phase 3: Page Objectパターンの完全統一 ✅

### Page Object更新
- [ ] `EnhancedBasePage` 基底クラス作成
- [ ] `LoginPage` 更新完了
- [ ] `DashboardPage` 更新完了
- [ ] `UploadPage` 更新完了
- [ ] `PreviewPage` 更新完了
- [ ] `AdminPage` 更新完了
- [ ] `ProfilePage` 更新完了

### 必須メソッド実装確認
各Page Objectで以下が実装されているか：
- [ ] `getPageIdentifier()`
- [ ] `waitForPageLoad()`
- [ ] `validateUserValue()`
- [ ] `validateAccessibility()`
- [ ] `measurePerformance()`

## 📋 Phase 4: UserJourneyヘルパーの全面活用 ✅

### UserJourney統合
- [ ] `UserJourneyHelper` クラス作成完了
- [ ] 主要テストでUserJourney使用
- [ ] テストテンプレート作成
- [ ] 既存テストの置換（最低10ファイル）

### 検証項目
- [ ] `completeFullUserJourney()` 動作確認
- [ ] `validateErrorMessage()` 動作確認
- [ ] `checkAccessibility()` 動作確認
- [ ] `cleanupTestData()` 動作確認

## 📋 Phase 5: CI/CD統合 ✅

### GitHub Actions設定
- [ ] `.github/workflows/e2e-quality-assurance.yml` 作成
- [ ] `.github/workflows/quality-gates.yml` 作成
- [ ] ブランチ保護ルール設定
- [ ] 必須ステータスチェック設定

### CI/CD検証
- [ ] PRでの自動チェック動作確認
- [ ] ハードコード検出の動作確認
- [ ] カバレッジレポート生成確認
- [ ] 品質ゲート動作確認

## 📋 Phase 6: 監視とメトリクス ✅

### ダッシュボード
- [ ] `scripts/quality-dashboard-server.ts` 作成
- [ ] `scripts/test-quality-report.ts` 作成
- [ ] リアルタイムダッシュボード動作確認
- [ ] メトリクス履歴保存確認

### メトリクス目標達成
- [ ] TestDataFactory採用率 ≥ 90%
- [ ] ハードコードファイル数 = 0
- [ ] Page Object採用率 ≥ 90%
- [ ] テストカバレッジ ≥ 80%

## 📋 Phase 7: チーム移行とトレーニング ✅

### ドキュメント
- [ ] `docs/E2E_TEST_GUIDELINES.md` 作成
- [ ] `docs/TEST_GUIDELINES.md` 作成
- [ ] `MIGRATION_COMPLETION_CHECKLIST.md` 作成（このファイル）
- [ ] README更新

### チーム準備
- [ ] ガイドライン共有会実施
- [ ] ペアプログラミングセッション実施
- [ ] Q&Aセッション実施
- [ ] フィードバック収集

## 🎯 最終確認

### 定量的目標達成確認

```bash
# メトリクス確認スクリプト実行
npm run quality:report

# 期待される結果
# - Hardcoded test data: 0 files
# - TestDataFactory adoption: 100%
# - Page Object adoption: 100%
# - Test coverage: ≥80%
# - Average execution time: <5 minutes
```

### 品質チェック

```bash
# 全テスト実行
npm run test:e2e

# カバレッジ確認
npm run test:coverage

# パフォーマンステスト
npm run test:performance

# アクセシビリティテスト
npm run test:a11y
```

### 最終レポート生成

```bash
# 品質ダッシュボード起動
npm run dashboard:start

# ブラウザで確認
open http://localhost:8080
```

## ✅ 承認サイン

### 技術リード承認
- [ ] 名前: ________________
- [ ] 日付: ________________
- [ ] コメント: ________________

### QAリード承認
- [ ] 名前: ________________
- [ ] 日付: ________________
- [ ] コメント: ________________

### プロジェクトマネージャー承認
- [ ] 名前: ________________
- [ ] 日付: ________________
- [ ] コメント: ________________

---

## 📊 移行完了基準

すべての項目にチェックが入り、以下の条件を満たしたら移行完了：

1. **ハードコード: 0件**
2. **TestDataFactory採用率: 100%**
3. **全テストがグリーン**
4. **CI/CDパイプライン稼働中**
5. **チーム全員がガイドライン理解**

---

*移行完了日: ________________*
*最終更新: 2024-08-30*
```
```
```

---

これで7つのフェーズすべてのプロンプトが完成しました。各プロンプトは以下の特徴があります：

1. **具体的なファイルパス**と実装内容
2. **完全なコード例**（コピー＆ペースト可能）
3. **実行コマンド**と検証方法
4. **トラブルシューティング**ガイド
5. **期待される結果**の明示

これらのプロンプトをSonnetに与えることで、確実に各フェーズを実装できます。
# 詳細実装計画書

## 作成日時
2025-08-17

## 実装目標
- E2Eテスト成功率100%の達成
- アクセシビリティ準拠
- 保守性の高いテストアーキテクチャの構築

## Phase 1: DOM構造最適化とテスト基盤整備（即日実装）

### 1.1 UploadFormのDOM構造改善

#### 現在の問題
- `SubmitButton`が別コンポーネントとして分離
- `useFormStatus`フックによる再レンダリング問題
- フォーカス管理の複雑性

#### 実装計画

**ファイル**: `/src/components/upload/UploadForm.tsx`

**Step 1: SubmitButtonの統合**
```typescript
// 変更前: 別コンポーネント
function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button>...</button>;
}

// 変更後: インライン統合
export default function UploadForm() {
  const [state, formAction] = useActionState(uploadFileAction, null);
  const [isPending, setIsPending] = useState(false);
  
  // formActionをラップして pending状態を管理
  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    try {
      await formAction(formData);
    } finally {
      setIsPending(false);
    }
  };
  
  return (
    <form action={handleSubmit}>
      <input type="file" />
      <button type="submit" disabled={isPending || !fileName}>
        {isPending ? 'アップロード中...' : 'アップロード'}
      </button>
    </form>
  );
}
```

**Step 2: セマンティックHTML構造の強化**
```typescript
<form 
  action={formAction} 
  className="space-y-4" 
  data-testid="upload-form"
  aria-label="ファイルアップロードフォーム"
>
  <fieldset>
    <legend className="sr-only">PowerPointファイルのアップロード</legend>
    
    <div className="form-group">
      <label htmlFor="file-input" className="block text-sm font-medium mb-2">
        ファイルを選択
        <span className="text-red-500 ml-1" aria-label="必須">*</span>
      </label>
      <input
        id="file-input"
        type="file"
        name="file"
        accept={FILE_EXTENSIONS.POWERPOINT}
        onChange={handleFileChange}
        disabled={state?.success}
        required
        aria-required="true"
        aria-invalid={!!clientError}
        aria-describedby="file-help file-error"
        className="..."
      />
      <p id="file-help" className="mt-1 text-sm text-gray-500">
        対応形式: .pptx, .ppt（最大{FILE_SIZE_LIMITS.MAX_FILE_SIZE_LABEL}）
      </p>
      {clientError && (
        <p id="file-error" role="alert" className="mt-1 text-sm text-red-600">
          {clientError}
        </p>
      )}
    </div>
    
    <button
      type="submit"
      disabled={isPending || !!clientError || !fileName}
      aria-busy={isPending}
      aria-disabled={isPending || !!clientError || !fileName}
      className="..."
    >
      {isPending ? 'アップロード中...' : 'アップロード'}
    </button>
  </fieldset>
</form>
```

### 1.2 キーボードナビゲーションテストの再設計

**ファイル**: `/e2e/improved-upload-flow.spec.ts`

```typescript
test('キーボードナビゲーション - 自然なDOM順序', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/upload`);
  
  // メインコンテンツにスキップ
  await page.keyboard.press('Tab'); // スキップリンク
  await page.keyboard.press('Enter'); // メインコンテンツへジャンプ
  
  // 最初のインタラクティブ要素を探す
  const firstInteractiveElement = await page.evaluate(() => {
    const elements = document.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex="0"]'
    );
    return elements[0]?.getAttribute('data-testid') || elements[0]?.tagName;
  });
  
  // ファイル入力へのフォーカスを確認
  await page.keyboard.press('Tab');
  const fileInputFocused = await page.evaluate(() => {
    const activeEl = document.activeElement;
    return activeEl?.tagName === 'INPUT' && activeEl.getAttribute('type') === 'file';
  });
  expect(fileInputFocused).toBeTruthy();
  
  // アップロードボタンへのフォーカス移動
  await page.keyboard.press('Tab');
  const buttonFocused = await page.evaluate(() => {
    const activeEl = document.activeElement;
    return activeEl?.tagName === 'BUTTON' && 
           activeEl?.textContent?.includes('アップロード');
  });
  expect(buttonFocused).toBeTruthy();
});
```

### 1.3 ファイル一覧テストの改善

```typescript
test('アップロード後のファイル確認', async ({ page, baseURL }) => {
  // 一意のファイル名を生成
  const uniqueId = Date.now();
  const testFileName = `test-${uniqueId}.pptx`;
  
  // テスト用ファイルを作成
  const testFilePath = join(testFilesDir, testFileName);
  fs.copyFileSync(validPPTXPath, testFilePath);
  
  try {
    // アップロード
    await page.goto(`${baseURL}/upload`);
    await page.setInputFiles('input[type="file"]', testFilePath);
    await page.click('button[type="submit"]');
    
    // 成功を待つ（URLの変更またはメッセージ）
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }),
      page.waitForSelector('[data-testid="upload-success"]', { timeout: 10000 })
    ]);
    
    // ダッシュボードで確認
    await page.goto(`${baseURL}/dashboard`);
    
    // ファイルが表示されるまで待つ
    await page.waitForFunction(
      (fileName) => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.some(el => el.textContent?.includes(fileName));
      },
      testFileName,
      { timeout: 10000 }
    );
    
    // ファイルの存在を確認
    const fileExists = await page.locator(`text="${testFileName}"`).first().isVisible();
    expect(fileExists).toBeTruthy();
    
  } finally {
    // クリーンアップ
    fs.unlinkSync(testFilePath);
    // TODO: DBからもファイルを削除
  }
});
```

## Phase 2: Page Object Modelの実装（2日目）

### 2.1 Page Objectの作成

**ファイル**: `/e2e/pages/UploadPage.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class UploadPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.locator('button[type="submit"]:has-text("アップロード")');
    this.errorMessage = page.locator('[role="alert"], [data-testid="upload-error"]');
    this.successMessage = page.locator('[data-testid="upload-success"]');
  }
  
  async goto() {
    await this.page.goto('/upload');
  }
  
  async selectFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }
  
  async upload() {
    await this.uploadButton.click();
  }
  
  async waitForSuccess() {
    await Promise.race([
      this.page.waitForURL('**/dashboard', { timeout: 10000 }),
      this.successMessage.waitFor({ state: 'visible', timeout: 10000 })
    ]);
  }
  
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }
  
  async isUploadButtonEnabled(): Promise<boolean> {
    return await this.uploadButton.isEnabled();
  }
}
```

### 2.2 Test Fixtureの作成

**ファイル**: `/e2e/fixtures/pages.ts`

```typescript
import { test as base } from '@playwright/test';
import { UploadPage } from '../pages/UploadPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';

type Pages = {
  uploadPage: UploadPage;
  dashboardPage: DashboardPage;
  loginPage: LoginPage;
};

export const test = base.extend<Pages>({
  uploadPage: async ({ page }, use) => {
    await use(new UploadPage(page));
  },
  
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect } from '@playwright/test';
```

### 2.3 テストの書き換え

```typescript
import { test, expect } from './fixtures/pages';

test('ファイルアップロード - Page Object使用', async ({ uploadPage, dashboardPage }) => {
  await uploadPage.goto();
  await uploadPage.selectFile('./test-file.pptx');
  await uploadPage.upload();
  await uploadPage.waitForSuccess();
  
  await dashboardPage.goto();
  const files = await dashboardPage.getFileList();
  expect(files).toContain('test-file.pptx');
});
```

## Phase 3: アクセシビリティ強化（3日目）

### 3.1 ARIAランドマークの追加

**ファイル**: `/src/app/upload/page.tsx`

```typescript
export default function UploadPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <header role="banner">
        <h1 id="page-title" className="text-2xl font-bold mb-6">
          PowerPointファイルのアップロード
        </h1>
      </header>
      
      <main role="main" aria-labelledby="page-title">
        <section aria-label="アップロードフォーム">
          <UploadForm />
        </section>
        
        <aside role="complementary" aria-label="ヘルプ情報">
          <h2 className="text-lg font-semibold mb-2">ご利用ガイド</h2>
          <ul className="list-disc list-inside">
            <li>対応形式: .pptx, .ppt</li>
            <li>最大ファイルサイズ: 100MB</li>
            <li>一度に1ファイルのみアップロード可能</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}
```

### 3.2 スキップリンクの実装

```typescript
export default function Layout({ children }) {
  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only">
        メインコンテンツへスキップ
      </a>
      <nav role="navigation">...</nav>
      <main id="main-content" role="main">
        {children}
      </main>
    </>
  );
}
```

## 実装スケジュール

| 日程 | タスク | 担当 | 完了条件 |
|------|--------|------|----------|
| Day 1 AM | DOM構造最適化 | 開発 | tabindex削除、統合完了 |
| Day 1 PM | テスト修正 | QA | 20/20テスト成功 |
| Day 2 AM | Page Object実装 | 開発 | 3つのPage Object作成 |
| Day 2 PM | テスト移行 | QA | POM使用テスト5本作成 |
| Day 3 | アクセシビリティ | 開発 | ARIA対応、a11y監査パス |

## 成功指標

1. **テスト成功率**: 100%（スキップを除く）
2. **テスト実行時間**: 現在の50%以下
3. **アクセシビリティスコア**: Lighthouse 95点以上
4. **コードカバレッジ**: 80%以上維持

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| DOM変更による既存機能への影響 | 高 | 段階的リリース、Feature Flag使用 |
| テスト移行時の一時的な不安定性 | 中 | 並行運用期間を設ける |
| アクセシビリティ対応の工数超過 | 低 | 最小限の対応から開始 |
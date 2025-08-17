# E2Eテスト - エキスパート視点からの追加洞察

## 作成日時
2025-08-17

## エキスパートによる技術的検証結果

### 1. React制御コンポーネント vs Playwright非制御操作の衝突

#### 問題の本質
- **制御されたコンポーネント**: Reactが内部状態でDOMを管理
- **非制御的操作**: PlaywrightがDOMを直接操作
- **衝突点**: `useFormStatus`のような状態管理フックが再レンダリングを引き起こし、Playwrightのフォーカス操作を上書き

#### 技術的詳細
```typescript
// Reactの制御フロー
useFormStatus() → pending状態変化 → SubmitButton再レンダリング → DOMフォーカスリセット

// Playwrightの非制御フロー  
button.focus() → DOM直接操作 → Reactに認識されない → 次の再レンダリングで消失
```

#### 解決策の妥当性
「ユーザー体験をテストする」アプローチは、この制御/非制御の衝突を回避する最善の方法。実装詳細への依存を排除することで、テストの安定性と保守性を両立。

### 2. 非同期処理のFlakiness（不安定性）対策

#### `page.waitForFunction`の重要性
```typescript
// ❌ 悪い例：固定長待機
await page.waitForTimeout(5000); // 遅すぎるか、不十分か

// ✅ 良い例：条件ベース待機
await page.waitForFunction(
  (count) => document.querySelectorAll('[data-testid="file-item"]').length > count,
  initialFileCount,
  { timeout: 10000 }
);
```

**利点**:
- ポーリングによる効率的な待機
- 条件が満たされた瞬間に続行
- タイムアウトによる無限待機の防止

#### データクリーンアップの完全性
```typescript
test('ファイルアップロード', async ({ page }) => {
  let uploadedFileId: string | undefined;
  
  try {
    // テスト実行
    uploadedFileId = await uploadFile(page);
    // アサーション
    expect(uploadedFileId).toBeDefined();
  } finally {
    // 成否に関わらず必ずクリーンアップ
    if (uploadedFileId) {
      await deleteFile(page, uploadedFileId).catch(console.error);
    }
  }
});
```

### 3. Server Actionsモック化の注意点

#### バージョン依存性への対策
```typescript
// Next.jsバージョンに依存しない抽象化
const SERVER_ACTION_PATTERNS = [
  '**/_next/server/**',  // Next.js 14
  '**/api/**',           // フォールバック
  '**/__nextjs_original-stack-frame**' // デバッグ用
];

test.use({
  context: async ({ context }, use) => {
    for (const pattern of SERVER_ACTION_PATTERNS) {
      await context.route(pattern, (route) => {
        // バージョンに関わらず動作するモック
      });
    }
    await use(context);
  }
});
```

#### モック戦略の階層化
```typescript
// Level 1: ネットワーク層でのモック（最も安定）
await context.route('**', mockNetworkResponse);

// Level 2: APIレスポンスのモック（中程度の安定性）
await mockServerAction('uploadFile', mockResponse);

// Level 3: データベース層でのモック（最も脆弱）
await mockDatabase.insert(testData);
```

## 追加の重要な洞察

### 1. テストピラミッドの再考

```
         /\
        /E2E\      ← 少数の重要なユーザーフロー
       /------\
      /統合テスト\   ← API境界のテスト
     /----------\
    /ユニットテスト\  ← ビジネスロジックの検証
   /--------------\
```

E2Eテストは「少数精鋭」であるべき。現在の23個のテストケースは多すぎる可能性。

### 2. テスト環境の分離戦略

```typescript
// 環境ごとの設定
const testConfig = {
  development: {
    baseURL: 'http://localhost:3000',
    database: 'dev_db',
    mockEnabled: false
  },
  test: {
    baseURL: 'http://localhost:3001',
    database: 'test_db',  // 完全に分離されたテストDB
    mockEnabled: true
  },
  ci: {
    baseURL: process.env.CI_URL,
    database: 'ci_db',
    mockEnabled: true
  }
};
```

### 3. 観測可能性（Observability）の導入

```typescript
// テスト実行の詳細なロギング
test.beforeEach(async ({ page }, testInfo) => {
  // ブラウザコンソールログの収集
  page.on('console', msg => {
    testInfo.attachments.push({
      name: 'console-log',
      body: Buffer.from(`${msg.type()}: ${msg.text()}\n`),
      contentType: 'text/plain'
    });
  });
  
  // ネットワークリクエストの記録
  page.on('request', request => {
    console.log(`[REQUEST] ${request.method()} ${request.url()}`);
  });
});
```

## 実装優先順位

### Phase 0: 即座の安定化（今すぐ）
```typescript
// 不安定なテストを条件付きスキップ
test.skip(process.env.CI === 'true', 'CI環境では不安定');
```

### Phase 1: 基盤整備（1週間）
- テストデータベースの分離
- Page Object Modelの実装
- 基本的なヘルパー関数の作成

### Phase 2: 段階的改善（2-4週間）
- 重要なユーザーフローに絞ったE2Eテスト
- 統合テストレイヤーの強化
- モック戦略の実装

### Phase 3: 継続的最適化（継続的）
- メトリクス収集とダッシュボード
- Flaky testの自動検出
- テスト実行時間の最適化

## 結論

エキスパートの検証により、以下の点が確認されました：

1. **React制御/非制御の衝突**は、Modern Web Frameworksにおける本質的な課題
2. **非同期処理のFlakiness**は、適切な待機戦略で解決可能
3. **Server Actionsのモック化**は、バージョン依存性を考慮した設計が必要

最も重要な教訓：
**「テストは実装の鏡ではなく、ユーザー体験の保証であるべき」**

この原則に従えば、実装が変わってもテストは壊れず、真に価値のあるテストスイートを構築できます。
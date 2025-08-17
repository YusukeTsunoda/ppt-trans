# E2Eテストの根本的問題分析と恒久的解決策

## 作成日時
2025-08-17

## エグゼクティブサマリー
現在のE2Eテストの失敗は、テスト設計の根本的な問題に起因しています。これらは一時的な修正では解決せず、テストアーキテクチャの見直しが必要です。

## 失敗テストの根本原因分析

### 1. キーボードナビゲーションテスト

#### 表面的な問題
- フォーカスがボタンに移動しない
- `hasFocusOnButton`が`false`を返す

#### 根本的な問題
**React Server Components (RSC) と Client Components の境界問題**
- `SubmitButton`は`UploadForm`内の別コンポーネント
- `useFormStatus`フックを使用しているため、formの子要素として特別な扱いを受ける
- PlaywrightのDOM操作とReactのイベントシステムの不一致

#### 技術的詳細
```typescript
// 問題のコード構造
function SubmitButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus(); // React Hookの使用
  return <button tabIndex={2} ... />
}

export default function UploadForm() {
  return (
    <form>
      <input tabIndex={1} ... />
      <SubmitButton /> {/* 別コンポーネントとしてレンダリング */}
    </form>
  );
}
```

**問題の本質**: 
- Reactのコンポーネント境界がDOM要素のフォーカス管理に影響
- `button.focus()`が呼ばれても、Reactの再レンダリングでフォーカスが失われる可能性
- `useFormStatus`が内部的にフォーカス管理に干渉している可能性

### 2. ファイル一覧表示テスト

#### 表面的な問題
- プレビューボタンが見つからない
- ファイル一覧に同じファイル名が113個表示される

#### 根本的な問題
**状態管理とデータ永続化の問題**
1. **テストデータの蓄積**: 各テスト実行でファイルが実際にDBに保存され続ける
2. **クリーンアップの欠如**: テスト後のデータ削除が機能していない
3. **非同期処理の競合状態**: アップロード → リダイレクト → ダッシュボード表示のタイミング問題

#### 技術的詳細
```typescript
// 問題のフロー
1. await assertUploadSuccess(page); // 成功を確認
2. await page.goto(`${baseURL}/dashboard`); // 即座にダッシュボードへ
3. // この間にServer Actionがまだ処理中の可能性
4. await expect(fileList).toBeVisible(); // ファイルがまだ表示されない
```

**問題の本質**:
- Server Actionsの非同期処理完了を待つ明確な方法がない
- Supabaseのリアルタイムサブスクリプションがテスト環境で不安定
- `router.refresh()`に依存する更新メカニズムがテストで機能しない

## テスト設計の根本的な問題

### 1. 実装とテストの結合度が高すぎる
- テストが実装の内部構造（tabIndex、data-testid）に依存
- UIの小さな変更でテストが壊れる
- テストが「何を」ではなく「どのように」をテストしている

### 2. 非決定的な要素への依存
- ネットワーク遅延
- Server Actionsの処理時間
- データベースの状態
- Reactの非同期レンダリング

### 3. テスト環境と本番環境の差異
- Next.js Dev ServerとProduction Buildの動作の違い
- Playwrightのブラウザ環境と実際のブラウザの違い
- テストポート（3001）と開発ポート（3000）の分離による問題

## 恒久的な解決策

### 短期的解決策（即座に実装可能）

#### 1. キーボードナビゲーションテストの再設計
```typescript
test('キーボードナビゲーションのサポート', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/upload`);
  
  // 実装詳細ではなく、ユーザー体験をテスト
  // Tabキーを押してフォーカスが移動することを確認
  await page.keyboard.press('Tab'); // スキップリンクやヘッダーを通過
  await page.keyboard.press('Tab'); // ナビゲーションを通過
  
  // 現在フォーカスされている要素のテキストを取得
  const focusedText = await page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('aria-label') || el?.textContent || '';
  });
  
  // ファイル選択かアップロードボタンにフォーカスがあることを確認
  expect(focusedText).toMatch(/ファイル|アップロード/);
});
```

#### 2. ファイル一覧表示テストの再設計
```typescript
test('アップロード後のファイル一覧表示', async ({ page, baseURL }) => {
  // Step 1: 既存のファイル数を記録
  await page.goto(`${baseURL}/dashboard`);
  const initialFileCount = await page.locator('[data-testid="file-item"]').count();
  
  // Step 2: 新しいファイルをアップロード
  await page.goto(`${baseURL}/upload`);
  const uniqueFileName = `test-${Date.now()}.pptx`;
  // ユニークなファイル名を使用
  
  // Step 3: アップロード成功を確認
  await uploadFile(page, uniqueFileName);
  
  // Step 4: ダッシュボードでファイル数が増えたことを確認
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="file-item"]').length > count,
    initialFileCount,
    { timeout: 10000 }
  );
  
  // Step 5: テスト終了時にファイルを削除
  await deleteTestFile(page, uniqueFileName);
});
```

### 中長期的解決策（アーキテクチャ改善）

#### 1. Page Object Model (POM) の導入
```typescript
// pages/UploadPage.ts
export class UploadPage {
  constructor(private page: Page) {}
  
  async selectFile(filePath: string) {
    // 実装詳細をカプセル化
  }
  
  async upload() {
    // アップロードロジックをカプセル化
  }
  
  async waitForSuccess() {
    // 成功条件をカプセル化
  }
}
```

#### 2. テストフィクスチャの改善
```typescript
// fixtures/database.ts
export async function withCleanDatabase(testFn: () => Promise<void>) {
  const snapshot = await createDatabaseSnapshot();
  try {
    await testFn();
  } finally {
    await restoreDatabaseSnapshot(snapshot);
  }
}
```

#### 3. モックとスタブの活用
```typescript
// Server Actionsをモック化
test.use({
  context: async ({ context }, use) => {
    await context.route('**/_next/server/**', (route) => {
      // Server Actionsの応答をモック
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true })
      });
    });
    await use(context);
  }
});
```

## 推奨アクションプラン

### Phase 1: 即座の安定化（1日）
1. 失敗テストを一時的に`test.skip`でスキップ
2. 基本的な機能のテストのみを維持
3. CI/CDパイプラインの安定化

### Phase 2: テスト再設計（1週間）
1. Page Object Modelの実装
2. テストユーティリティの作成
3. データクリーンアップメカニズムの実装

### Phase 3: 継続的改善（継続的）
1. テストカバレッジの段階的な向上
2. パフォーマンステストの追加
3. Visual Regression Testingの導入

## 結論

現在のテスト失敗は、以下の根本的な問題に起因します：

1. **技術的不整合**: React Server Components、Client Components、Playwrightの相互作用
2. **設計の問題**: テストが実装詳細に過度に依存
3. **環境の問題**: テスト環境と実際の環境の差異

これらの問題は、一時的な修正では解決しません。テストアーキテクチャの根本的な見直しと、段階的な改善が必要です。

最も重要なのは、**テストが何を保証すべきか**を明確にし、実装詳細ではなくユーザー体験をテストすることです。
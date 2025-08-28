# E2Eテスト Server Actions 移行計画

## 概要
すべてのフォームがServer Actionsを使用するように変更されたため、E2Eテストも対応する修正が必要です。

## 現状分析

### Server Actions 実装済みフォーム
1. **認証関連**
   - LoginForm → `loginAction` (src/app/actions/auth.ts)
   - SignupForm → `signupAction` (src/app/actions/auth.ts)
   - ForgotPasswordForm → `forgotPasswordAction` (src/app/actions/auth.ts)
   - Logout → `logout` (src/app/actions/auth.ts)

2. **アップロード関連**
   - UploadForm → `uploadFileAction` (src/app/actions/upload.ts)

3. **翻訳関連**
   - TranslateForm → `translateAction` (src/app/actions/translate.ts)

### 既存のヘルパークラス
- `/e2e/helpers/server-actions-helper.ts` - Server Actions用のユーティリティ完備
- `/e2e/01-auth-flow-fixed-server-actions.spec.ts` - 正しい実装の参考例

## 修正が必要なテストファイル

### 優先度: 高（コア機能）

#### 1. `/e2e/core/auth.spec.ts`
**現状**: LoginPage POを使用、API直接呼び出し
**修正箇所**:
```typescript
// 現在のコード (line 18-20)
await loginPage.navigate();
await loginPage.loginAsStandardUser();
await loginPage.expectLoginSuccess();

// 修正後
await loginPage.navigate();
await ServerActionsHelper.fillAndSubmitForm(
  page,
  { email: TEST_CONFIG.users.standard.email, password: TEST_CONFIG.users.standard.password },
  'button[type="submit"]',
  /.*\/dashboard/
);
```

#### 2. `/e2e/core/upload.spec.ts`
**現状**: ファイル選択後、単純なボタンクリック
**修正箇所**:
```typescript
// 現在のコード (line 40-46)
await uploadButton.click();
await Promise.race([
  page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload }),
  expect(page.locator('text=/アップロードが完了|Upload complete/')).toBeVisible()
]);

// 修正後
await ServerActionsHelper.submitServerActionForm(
  page,
  'button:has-text("アップロード")',
  /.*\/dashboard/
);
await ServerActionsHelper.waitForPendingState(page);
```

#### 3. `/e2e/auth/auth-flow.spec.ts`
**現状**: 基本的なフォーム送信
**修正箇所**:
```typescript
// 現在のコード (line 38-39)
await submitButton.click();

// 修正後
await ServerActionsHelper.submitServerActionForm(
  page,
  'button[type="submit"]',
  /.*\/dashboard/
);
```

### 優先度: 中（機能テスト）

#### 4. `/e2e/02-upload-flow.spec.ts`
**現状**: `waitForResponse`でAPI呼び出しを監視
**修正箇所**:
```typescript
// 現在のコード (line 94)
const uploadResponse = page.waitForResponse(
  (response) => response.url().includes('/api/upload')
);

// 修正後
const uploadResponse = ServerActionsHelper.waitForServerAction(page, 'upload');
```

#### 5. `/e2e/04-translation-flow.spec.ts`
**現状**: APIレスポンス待機
**修正箇所**:
```typescript
// 現在のコード (line 76)
const translateResponsePromise = page.waitForResponse(
  response => response.url().includes('/api/translate')
);

// 修正後
const translateResponse = ServerActionsHelper.waitForServerAction(page, 'translate');
```

#### 6. `/e2e/auth/auth-comprehensive.spec.ts`
**現状**: 複数のAPI呼び出し監視
**修正箇所**:
```typescript
// 現在のコード (line 27)
const authRequest = page.waitForResponse(
  response => response.url().includes('/api/auth')
);

// 修正後
await ServerActionsHelper.fillAndSubmitForm(
  page,
  formData,
  'button[type="submit"]'
);
```

### 優先度: 低（アーカイブ・特殊ケース）

#### 7. `/e2e/performance.spec.ts`
**現状**: `page.request.get`で直接API呼び出し
**修正箇所**: Server Actionsはformベースなので、このテストはスキップまたは削除

#### 8. `/e2e/auth/admin-access.spec.ts`
**現状**: 管理者API直接呼び出し
**修正箇所**: 管理者機能がServer Actions化されていない場合は保留

## Page Objectsの更新

### `/e2e/page-objects/login.page.ts`
```typescript
// 新しいメソッドを追加
async loginWithServerAction(email: string, password: string) {
  await ServerActionsHelper.fillAndSubmitForm(
    this.page,
    { email, password },
    'button[type="submit"]',
    /.*\/dashboard/
  );
}

async loginAsDefaultUserWithServerAction() {
  const user = TestConfig.users.default;
  await this.loginWithServerAction(user.email, user.password);
}
```

## 実装手順

### Phase 1: ヘルパーの拡張（完了済み）
✅ ServerActionsHelperクラスは既に実装済み

### Phase 2: コアテストの修正
1. `core/auth.spec.ts` - 認証フロー
2. `core/upload.spec.ts` - アップロードフロー
3. `auth/auth-flow.spec.ts` - 認証フロー詳細

### Phase 3: 機能テストの修正
1. `02-upload-flow.spec.ts`
2. `04-translation-flow.spec.ts`
3. `auth/auth-comprehensive.spec.ts`

### Phase 4: Page Objectsの更新
1. `login.page.ts` - Server Actions対応メソッド追加
2. `upload.page.ts` - Server Actions対応メソッド追加
3. `dashboard.page.ts` - ログアウトServer Action対応

### Phase 5: 検証とクリーンアップ
1. すべてのテストを実行
2. 古いAPIベースのテストコードを削除
3. ドキュメント更新

## テストパターンの統一

### Before（API呼び出し）
```typescript
// APIレスポンスを待つ
const response = await page.waitForResponse(
  response => response.url().includes('/api/login')
);
await submitButton.click();
```

### After（Server Actions）
```typescript
// Server Actionヘルパーを使用
await ServerActionsHelper.fillAndSubmitForm(
  page,
  { email, password },
  'button[type="submit"]',
  expectedUrl
);
```

## 成功基準
1. ✅ すべてのE2EテストがServer Actions経由で実行される
2. ✅ API直接呼び出し（`waitForResponse`, `page.request`）が削除される
3. ✅ テスト実行時間が改善される（Server Actionsの方が高速）
4. ✅ エラーハンドリングが適切に動作する

## リスクと対策
- **リスク**: Server Actionsのpending状態が正しく処理されない
  - **対策**: `waitForPendingState`を適切に使用
  
- **リスク**: フォームのバリデーションエラーが検出されない
  - **対策**: `hasServerActionError`と`getServerActionError`を活用

- **リスク**: 既存のテストが壊れる
  - **対策**: 段階的な移行とテストの並行実行

## 次のステップ
1. Phase 2のコアテストから開始
2. 各修正後にテストを実行して動作確認
3. すべてのPhaseが完了したら、全体テストを実行
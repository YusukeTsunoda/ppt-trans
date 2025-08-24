# MVP E2Eテスト実装計画

## 🎯 目的
PPT TranslatorアプリケーションのMVP機能を確実に検証し、本番環境での安定性を保証する

## 📊 現状分析
- ✅ 実装済み: 基本的な認証、アップロード、翻訳、ダウンロード
- ⚠️ 要改善: エラーハンドリング、境界値テスト
- ❌ 未実装: セキュリティ、パフォーマンス、データ整合性

## 🔴 Priority 0: 即座に追加すべきMVP必須テスト

### 1. セキュリティテスト（core/security.spec.ts）
```typescript
test.describe('セキュリティ', () => {
  test('未認証アクセスの防止', async ({ page }) => {
    // ダッシュボードへの直接アクセスをブロック
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('他ユーザーのファイルアクセス防止', async ({ page }) => {
    // 別ユーザーのファイルIDでアクセス試行
    await page.goto('/preview/invalid-file-id');
    await expect(page.locator('text=/アクセス権限がありません|Forbidden/')).toBeVisible();
  });

  test('SQLインジェクション防止', async ({ page }) => {
    // 悪意のある入力での攻撃試行
    await page.fill('input[type="email"]', "admin'--");
    // エラーなく処理されることを確認
  });

  test('XSS攻撃防止', async ({ page }) => {
    // スクリプトタグを含むファイル名
    const xssFileName = '<script>alert("XSS")</script>.pptx';
    // サニタイズされて表示されることを確認
  });
});
```

### 2. データ整合性テスト（core/data-integrity.spec.ts）
```typescript
test.describe('データ整合性', () => {
  test('同時アップロードの処理', async ({ browser }) => {
    // 複数タブから同時アップロード
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    // 両方が正常に処理されることを確認
  });

  test('翻訳中のブラウザリロード', async ({ page }) => {
    // 翻訳開始
    await translateButton.click();
    // リロード
    await page.reload();
    // 状態が正しく復元されることを確認
  });

  test('セッションタイムアウト処理', async ({ page }) => {
    // 長時間放置後の操作
    await page.waitForTimeout(3600000); // 1時間
    // 適切にログイン画面へリダイレクト
  });
});
```

### 3. エラーリカバリーテスト（core/error-recovery.spec.ts）
```typescript
test.describe('エラーリカバリー', () => {
  test('ネットワーク切断からの復帰', async ({ page, context }) => {
    // オフラインモードをシミュレート
    await context.setOffline(true);
    await translateButton.click();
    // エラーメッセージ表示
    await expect(errorMessage).toBeVisible();
    
    // オンラインに復帰
    await context.setOffline(false);
    // リトライボタンで再実行可能
    await retryButton.click();
    await expect(translatedText).toBeVisible();
  });

  test('API制限エラーからの復帰', async ({ page }) => {
    // 429エラーをモック
    await context.route('**/api/translate', route => {
      route.fulfill({ status: 429 });
    });
    // 適切なエラーメッセージと待機時間表示
  });
});
```

## 🟡 Priority 1: MVP完成前に実装すべきテスト

### 4. パフォーマンステスト（features/performance.spec.ts）
```typescript
test.describe('パフォーマンス', () => {
  test('大容量ファイル（50MB）のアップロード', async ({ page }) => {
    const largeFile = generateLargeFile(50 * 1024 * 1024);
    // 3分以内に完了
    await expect(uploadComplete).toBeVisible({ timeout: 180000 });
  });

  test('100スライドの一括翻訳', async ({ page }) => {
    // バッチ処理が適切に動作
    // プログレスバーが正しく更新
    // 5分以内に完了
  });

  test('メモリリーク検証', async ({ page }) => {
    // 10回連続でアップロード・翻訳
    for (let i = 0; i < 10; i++) {
      await uploadAndTranslate();
    }
    // メモリ使用量が増加し続けないことを確認
  });
});
```

### 5. 多言語対応テスト（features/i18n.spec.ts）
```typescript
test.describe('多言語対応', () => {
  test('日本語UIでの完全動作', async ({ page }) => {
    await page.setLocale('ja-JP');
    // すべてのUIが日本語で表示
    // 日付フォーマットが日本式
  });

  test('特殊文字を含む翻訳', async ({ page }) => {
    // アラビア語、中国語（繁体字）への翻訳
    // RTL言語の正しい表示
  });
});
```

### 6. ユーザビリティテスト（features/usability.spec.ts）
```typescript
test.describe('ユーザビリティ', () => {
  test('キーボードのみでの操作', async ({ page }) => {
    // Tabキーでのナビゲーション
    // Enterキーでの送信
    // Escキーでのモーダル閉じ
  });

  test('スクリーンリーダー対応', async ({ page }) => {
    // ARIA属性の適切な設定
    // フォーカス管理
  });

  test('モバイル操作', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // タッチ操作のシミュレーション
    // レスポンシブデザインの確認
  });
});
```

## 🟢 Priority 2: MVP後の改善フェーズ

### 7. 統合テスト（integration/）
- Stripe決済フローの完全テスト
- メール通知の送信確認
- Webhook処理の検証
- サードパーティAPI連携

### 8. 負荷テスト（load/）
- 100同時ユーザーのシミュレーション
- 1000ファイル/日の処理
- DBコネクションプールの検証

## 📝 実装順序

### Week 1（即座に実装）
1. ✅ critical-path.spec.tsのエラー修正
2. 🔴 security.spec.ts - セキュリティテスト
3. 🔴 data-integrity.spec.ts - データ整合性
4. 🔴 error-recovery.spec.ts - エラーリカバリー

### Week 2（MVP完成前）
5. 🟡 performance.spec.ts - パフォーマンス基準
6. 🟡 i18n.spec.ts - 多言語対応
7. 🟡 usability.spec.ts - アクセシビリティ

### Week 3以降（継続的改善）
8. 🟢 統合テスト
9. 🟢 負荷テスト
10. 🟢 E2Eテストの並列実行最適化

## 🎯 成功基準

### MVP必須要件
- ✅ すべてのP0テストが100%パス
- ✅ Critical pathが30秒以内
- ✅ セキュリティテストがすべてパス
- ✅ データ整合性が保証される

### 品質目標
- テストカバレッジ: 80%以上
- 平均実行時間: 5分以内
- Flaky testの割合: 5%以下

## 🔧 テスト環境要件

### 必須
- Node.js 18+
- PostgreSQL 14+
- Supabase Local
- 4GB RAM minimum

### 推奨
- GitHub Actions CI/CD
- Datadog/Sentry monitoring
- Playwright Report hosting

## 📊 メトリクス追跡

### 週次レポート項目
- テスト実行数
- 成功率
- 平均実行時間
- 発見されたバグ数
- 修正されたバグ数

### アラート設定
- テスト失敗率 > 10%
- 実行時間 > 10分
- メモリ使用量 > 2GB
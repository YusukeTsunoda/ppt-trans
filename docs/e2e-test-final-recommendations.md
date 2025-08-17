# E2Eテスト最終改善推奨事項

## 作成日時
2025-08-17

## エキスパートレビューを踏まえた最終推奨事項

### 1. tabindexアンチパターンの回避

#### 問題：正の整数tabindexの危険性
```typescript
// ❌ アンチパターン：正の整数tabindex
<input tabIndex={1} />
<button tabIndex={2} />
```

**なぜ危険か：**
- DOM構造の自然な順序を破壊
- 視覚的順序とキーボード操作順序の不一致
- メンテナンス時の番号振り直しが必要
- アクセシビリティ（a11y）違反

#### 推奨解決策

**Option 1: DOM構造の最適化（最推奨）**
```typescript
// ✅ 良い例：自然なDOM順序
export default function UploadForm() {
  return (
    <form>
      {/* DOM順序 = フォーカス順序 = 視覚的順序 */}
      <label htmlFor="file-input">ファイルを選択</label>
      <input id="file-input" type="file" />
      <SubmitButton />
    </form>
  );
}

// SubmitButtonを同じコンポーネント内に統合
function UploadForm() {
  const { pending } = useFormStatus();
  
  return (
    <form>
      <input type="file" />
      {/* インラインでレンダリング */}
      <button type="submit" disabled={pending}>
        {pending ? 'アップロード中...' : 'アップロード'}
      </button>
    </form>
  );
}
```

**Option 2: tabindex="0"と"-1"のみを使用**
```typescript
// ✅ 許容される使用法
<div tabIndex={0}>フォーカス可能な要素</div>  // 自然な順序に含める
<div tabIndex={-1}>プログラムからのみフォーカス</div>  // キーボードナビゲーションから除外
```

**Option 3: フォーカス管理をReactで制御**
```typescript
function UploadForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Tab' && e.target === fileInputRef.current) {
      e.preventDefault();
      buttonRef.current?.focus();
    }
  };
  
  return (
    <form onKeyDown={handleKeyDown}>
      <input ref={fileInputRef} type="file" />
      <button ref={buttonRef} type="submit">アップロード</button>
    </form>
  );
}
```

### 2. キーボードナビゲーションテストの改善

#### ユーザー体験に基づいたテスト
```typescript
test('キーボードナビゲーションのサポート', async ({ page }) => {
  await page.goto('/upload');
  
  // 実際のユーザー操作を模倣
  // Step 1: ページにフォーカスを設定
  await page.locator('body').press('Tab');
  
  // Step 2: フォーカスが期待する要素に当たるまで確認
  let focusedElement = await page.evaluate(() => {
    return document.activeElement?.getAttribute('aria-label') || 
           document.activeElement?.tagName;
  });
  
  // スキップリンクやヘッダーをスキップ
  while (focusedElement !== 'INPUT' && focusedElement !== 'PowerPointファイルを選択') {
    await page.keyboard.press('Tab');
    focusedElement = await page.evaluate(() => {
      return document.activeElement?.getAttribute('aria-label') || 
             document.activeElement?.tagName;
    });
  }
  
  // Step 3: ファイル入力にフォーカスがあることを確認
  await expect(page.locator('input[type="file"]')).toBeFocused();
  
  // Step 4: Tabでボタンへ移動
  await page.keyboard.press('Tab');
  
  // Step 5: ボタンにフォーカスがあることを確認
  await expect(page.locator('button[type="submit"]')).toBeFocused();
  
  // Step 6: Shift+Tabで戻る
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('input[type="file"]')).toBeFocused();
});
```

### 3. Server Actionsのネットワークエラーテスト

#### 高度な解決策：外部APIのモック化

```typescript
test('Supabaseエラー時の適切なフォールバック', async ({ page, context }) => {
  // Supabaseのエンドポイントをインターセプト
  await context.route('https://*.supabase.co/**', route => {
    // Supabaseへのリクエストを失敗させる
    route.abort('failed');
  });
  
  await page.goto('/upload');
  
  // ファイル選択とアップロード
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(validPPTXPath);
  await page.click('button[type="submit"]');
  
  // Server Actionがエラーをハンドリングしてメッセージを表示
  await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="upload-error"]')).toContainText(
    /アップロードに失敗|エラーが発生/
  );
});
```

#### より現実的な代替案：クライアント側エラーのテスト

```typescript
test('大容量ファイルのクライアント側バリデーション', async ({ page }) => {
  await page.goto('/upload');
  
  // JavaScriptでFileオブジェクトをモック
  await page.evaluate(() => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'.repeat(101 * 1024 * 1024)], 'large.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
    
    // DataTransferをシミュレート
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    
    // changeイベントを発火
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  
  // エラーメッセージの確認
  await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
  await expect(page.locator('[data-testid="upload-error"]')).toContainText('100MB');
});
```

### 4. アクセシビリティを考慮した実装改善

#### ARIAランドマークの活用
```typescript
function UploadPage() {
  return (
    <main role="main" aria-labelledby="upload-heading">
      <h1 id="upload-heading">ファイルアップロード</h1>
      
      <nav role="navigation" aria-label="ステップインジケーター">
        <ol>
          <li aria-current="step">ファイル選択</li>
          <li>アップロード</li>
          <li>完了</li>
        </ol>
      </nav>
      
      <section role="region" aria-labelledby="upload-form-heading">
        <h2 id="upload-form-heading" className="sr-only">
          アップロードフォーム
        </h2>
        <UploadForm />
      </section>
    </main>
  );
}
```

#### フォーカストラップの実装
```typescript
function Modal({ children, isOpen, onClose }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;
    
    firstElement?.focus();
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);
  
  return isOpen ? (
    <div ref={modalRef} role="dialog" aria-modal="true">
      {children}
    </div>
  ) : null;
}
```

## 実装優先順位マトリックス

| 改善項目 | 影響度 | 実装難易度 | 優先度 |
|---------|--------|------------|--------|
| tabindex削除とDOM順序最適化 | 高 | 低 | **最優先** |
| キーボードナビゲーションテスト改善 | 中 | 低 | 高 |
| Supabase APIモック化 | 低 | 高 | 低 |
| ARIAランドマーク追加 | 高 | 低 | 高 |
| フォーカストラップ実装 | 中 | 中 | 中 |

## 段階的実装計画

### Phase 1: 即座の改善（1日）
1. ❌ tabindex={1}, tabIndex={2}を削除
2. ✅ DOM構造を論理的順序に再配置
3. ✅ キーボードナビゲーションテストを自然なTab順序ベースに変更

### Phase 2: アクセシビリティ強化（3日）
1. ARIAランドマークの追加
2. スクリーンリーダー対応の改善
3. フォーカスインジケーターの視覚的強化

### Phase 3: テスト安定化（1週間）
1. Page Object Modelの完全実装
2. テストヘルパー関数の拡充
3. CI環境でのテスト安定性向上

## 最終的な推奨事項

### やるべきこと
1. **DOM構造の最適化**を最優先で実施
2. **自然なTab順序**に依存したテストに変更
3. **ARIAランドマーク**でセマンティックな構造を明確化

### やってはいけないこと
1. **正の整数tabindex**の使用
2. **Playwrightのfocus()**に依存したテスト
3. **実装詳細**に依存した脆弱なテスト

### 長期的な目標
「アクセシビリティファースト」の開発文化を確立し、すべてのユーザーが快適に使用できるアプリケーションを構築する。

## 結論

tabindexの罠を回避し、DOM構造の最適化とユーザー体験ベースのテストに移行することで、より堅牢で保守性の高いアプリケーションとテストスイートを実現できます。

**最も重要な原則：**
> "The best tabindex is no tabindex" - アクセシビリティのベストプラクティス
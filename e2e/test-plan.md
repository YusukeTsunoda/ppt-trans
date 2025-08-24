# E2Eテスト実装計画

## 1. 認証フロー (Authentication Flow)

### 1.1 ユーザー登録テスト
**ファイル**: `e2e/auth/signup.spec.ts`
```typescript
test.describe('ユーザー登録', () => {
  test('新規ユーザー登録が成功する', async ({ page }) => {
    // 検証内容:
    // 1. /register ページにアクセス
    // 2. メールアドレス、パスワード、確認パスワードを入力
    // 3. 登録ボタンをクリック
    // 4. ダッシュボードへリダイレクトされることを確認
    // 5. ウェルカムメッセージが表示されることを確認
  });

  test('無効なメールアドレスでエラーが表示される', async ({ page }) => {
    // 検証内容:
    // 1. 不正なメール形式を入力
    // 2. エラーメッセージ「有効なメールアドレスを入力してください」が表示される
  });

  test('パスワードが一致しない場合エラーが表示される', async ({ page }) => {
    // 検証内容:
    // 1. パスワードと確認パスワードに異なる値を入力
    // 2. エラーメッセージ「パスワードが一致しません」が表示される
  });
});
```

### 1.2 ログインテスト
**ファイル**: `e2e/auth/login.spec.ts`
```typescript
test.describe('ログイン', () => {
  test('既存ユーザーがログインできる', async ({ page }) => {
    // 検証内容:
    // 1. /login ページにアクセス
    // 2. 有効な認証情報を入力
    // 3. ログインボタンをクリック
    // 4. ダッシュボードへリダイレクト
    // 5. ユーザーのメールアドレスがヘッダーに表示される
  });

  test('無効な認証情報でエラーが表示される', async ({ page }) => {
    // 検証内容:
    // 1. 誤ったパスワードを入力
    // 2. エラーメッセージ「メールアドレスまたはパスワードが正しくありません」が表示される
  });

  test('ログアウトが正常に動作する', async ({ page }) => {
    // 検証内容:
    // 1. ログイン済み状態でダッシュボードにアクセス
    // 2. ログアウトボタンをクリック
    // 3. ログインページへリダイレクト
    // 4. ダッシュボードへのアクセスが制限される
  });
});
```

## 2. ファイル管理機能 (File Management)

### 2.1 ファイルアップロードテスト
**ファイル**: `e2e/files/upload.spec.ts`
```typescript
test.describe('ファイルアップロード', () => {
  test('PPTXファイルを正常にアップロードできる', async ({ page }) => {
    // 検証内容:
    // 1. /upload ページにアクセス
    // 2. ドラッグ&ドロップエリアが表示される
    // 3. テスト用PPTXファイルを選択
    // 4. ファイル情報（名前、サイズ）が表示される
    // 5. アップロードボタンをクリック
    // 6. プログレスバーが表示される
    // 7. 完了後、プレビューページへリダイレクト
  });

  test('サポートされていないファイル形式でエラーが表示される', async ({ page }) => {
    // 検証内容:
    // 1. PDFやTXTファイルをアップロード試行
    // 2. エラーメッセージ「PPTXファイルのみアップロード可能です」が表示される
  });

  test('ファイルサイズ制限を超えた場合エラーが表示される', async ({ page }) => {
    // 検証内容:
    // 1. 50MB以上のファイルをアップロード試行
    // 2. エラーメッセージ「ファイルサイズは50MB以下にしてください」が表示される
  });
});
```

### 2.2 ファイル削除テスト
**ファイル**: `e2e/files/delete.spec.ts`
```typescript
test.describe('ファイル削除', () => {
  test('アップロードしたファイルを削除できる', async ({ page }) => {
    // 検証内容:
    // 1. ダッシュボードでファイル一覧を表示
    // 2. 削除ボタンをクリック
    // 3. 確認ダイアログで「はい」を選択
    // 4. ファイルが一覧から消える
    // 5. 「ファイルを削除しました」メッセージが表示される
  });

  test('削除確認でキャンセルした場合ファイルが残る', async ({ page }) => {
    // 検証内容:
    // 1. 削除ボタンをクリック
    // 2. 確認ダイアログで「キャンセル」を選択
    // 3. ファイルが一覧に残っている
  });
});
```

## 3. プレビュー機能 (Preview Functionality)

### 3.1 スライドプレビューテスト
**ファイル**: `e2e/preview/slide-preview.spec.ts`
```typescript
test.describe('スライドプレビュー', () => {
  test('アップロードしたPPTXのプレビューが表示される', async ({ page }) => {
    // 検証内容:
    // 1. プレビューページにアクセス
    // 2. スライドプレビューエリアが表示される
    // 3. プレースホルダー画像が表示される
    // 4. MVP説明メッセージが表示される
  });

  test('スライドナビゲーションが動作する', async ({ page }) => {
    // 検証内容:
    // 1. 「次へ」ボタンをクリック
    // 2. スライド番号が2に変わる
    // 3. 「前へ」ボタンをクリック
    // 4. スライド番号が1に戻る
    // 5. サムネイル一覧から特定スライドを選択
    // 6. 選択したスライドが表示される
  });

  test('抽出されたテキストが表示される', async ({ page }) => {
    // 検証内容:
    // 1. テキスト内容セクションが表示される
    // 2. 原文が表示される
    // 3. テーブルデータがタブ区切りで表示される
    // 4. テキストが位置順（左上から右下）にソートされている
  });
});
```

### 3.2 ズーム・パン機能テスト
**ファイル**: `e2e/preview/zoom-pan.spec.ts`
```typescript
test.describe('ズーム・パン機能', () => {
  test('ズームイン・アウトが動作する', async ({ page }) => {
    // 検証内容:
    // 1. ズームインボタンをクリック
    // 2. ズームレベルが125%に変わる
    // 3. ズームアウトボタンをクリック
    // 4. ズームレベルが100%に戻る
    // 5. リセットボタンで初期状態に戻る
  });

  test('ドラッグでパンができる', async ({ page }) => {
    // 検証内容:
    // 1. プレビューエリアをドラッグ
    // 2. 画像が移動する
    // 3. リセットボタンで位置が初期化される
  });

  test('Ctrl+スクロールでズームできる', async ({ page }) => {
    // 検証内容:
    // 1. Ctrlキーを押しながらマウスホイール
    // 2. ズームレベルが変化する
  });
});
```

### 3.3 テキストハイライト機能テスト
**ファイル**: `e2e/preview/text-highlight.spec.ts`
```typescript
test.describe('テキストハイライト機能', () => {
  test('テキストクリックでプレビュー上にハイライトが表示される', async ({ page }) => {
    // 検証内容:
    // 1. テキスト内容の原文をクリック
    // 2. 該当テキストが黄色でハイライトされる
    // 3. プレビュー上に位置がハイライトボックスで表示される
    // 4. 再度クリックでハイライトが解除される
  });
});
```

## 4. 翻訳機能 (Translation)

### 4.1 単一スライド翻訳テスト
**ファイル**: `e2e/translation/single-slide.spec.ts`
```typescript
test.describe('単一スライド翻訳', () => {
  test('現在のスライドを翻訳できる', async ({ page }) => {
    // 検証内容:
    // 1. 言語選択ドロップダウンで「日本語」を選択
    // 2. 「現在のスライドを翻訳」ボタンをクリック
    // 3. ボタンが「翻訳中...」に変わる
    // 4. 翻訳結果が表示される
    // 5. 翻訳済みマークが表示される
  });
});
```

### 4.2 全スライド翻訳テスト
**ファイル**: `e2e/translation/all-slides.spec.ts`
```typescript
test.describe('全スライド翻訳', () => {
  test('すべてのスライドを一括翻訳できる', async ({ page }) => {
    // 検証内容:
    // 1. 「すべて翻訳」ボタンをクリック
    // 2. プログレス表示
    // 3. 全スライドに翻訳済みマークが付く
    // 4. 各スライドの翻訳結果が確認できる
  });
});
```

### 4.3 翻訳編集テスト
**ファイル**: `e2e/translation/edit-translation.spec.ts`
```typescript
test.describe('翻訳編集', () => {
  test('翻訳結果を編集できる', async ({ page }) => {
    // 検証内容:
    // 1. 翻訳済みテキストの「編集」ボタンをクリック
    // 2. テキストエリアが表示される
    // 3. テキストを修正
    // 4. 「保存」ボタンをクリック
    // 5. 修正内容が反映される
  });

  test('翻訳編集をキャンセルできる', async ({ page }) => {
    // 検証内容:
    // 1. 編集モードに入る
    // 2. テキストを変更
    // 3. 「キャンセル」ボタンをクリック
    // 4. 元のテキストが保持される
  });

  test('ダブルクリックで編集モードに入れる', async ({ page }) => {
    // 検証内容:
    // 1. 翻訳済みテキストをダブルクリック
    // 2. 編集モードに入る
  });
});
```

### 4.4 翻訳済みファイルダウンロードテスト
**ファイル**: `e2e/translation/download.spec.ts`
```typescript
test.describe('翻訳済みファイルダウンロード', () => {
  test('翻訳済みPowerPointをダウンロードできる', async ({ page }) => {
    // 検証内容:
    // 1. 翻訳を実行
    // 2. 「翻訳済みをダウンロード」ボタンをクリック
    // 3. ボタンが「生成中...」に変わる
    // 4. ダウンロードが開始される
    // 5. ファイル名が「translated_元のファイル名.pptx」形式
  });

  test('翻訳がない場合ダウンロードボタンが無効', async ({ page }) => {
    // 検証内容:
    // 1. 翻訳前の状態でダウンロードボタンが無効化されている
  });
});
```

## 5. ダッシュボード機能 (Dashboard)

### 5.1 ファイル一覧表示テスト
**ファイル**: `e2e/dashboard/file-list.spec.ts`
```typescript
test.describe('ファイル一覧', () => {
  test('アップロードしたファイルが一覧に表示される', async ({ page }) => {
    // 検証内容:
    // 1. ダッシュボードにアクセス
    // 2. ファイル名、サイズ、ステータス、日時が表示される
    // 3. ステータスバッジの色が正しい（uploaded=青、completed=緑）
  });

  test('ファイルがない場合の空状態が表示される', async ({ page }) => {
    // 検証内容:
    // 1. ファイルがない状態でダッシュボードにアクセス
    // 2. 「まだファイルがアップロードされていません」メッセージ
    // 3. 「最初のファイルをアップロード」ボタンが表示される
  });

  test('更新ボタンでリストが更新される', async ({ page }) => {
    // 検証内容:
    // 1. 更新ボタンをクリック
    // 2. ページがリロードされる
    // 3. 最新のファイルリストが表示される
  });
});
```

### 5.2 ファイル操作テスト
**ファイル**: `e2e/dashboard/file-operations.spec.ts`
```typescript
test.describe('ファイル操作', () => {
  test('元ファイルをダウンロードできる', async ({ page }) => {
    // 検証内容:
    // 1. 「元ファイル」ボタンをクリック
    // 2. オリジナルファイルがダウンロードされる
  });

  test('プレビューボタンでプレビューページへ遷移する', async ({ page }) => {
    // 検証内容:
    // 1. 「プレビュー」ボタンをクリック
    // 2. /preview/[id] ページへ遷移
    // 3. 正しいファイルが表示される
  });

  test('翻訳ボタンで翻訳が開始される', async ({ page }) => {
    // 検証内容:
    // 1. 「翻訳」ボタンをクリック
    // 2. ステータスが「処理中」に変わる
    // 3. 完了後「完了」ステータスに変わる
    // 4. 「翻訳済み」ダウンロードボタンが表示される
  });
});
```

## 6. プロフィール機能 (Profile)

### 6.1 プロフィール表示テスト
**ファイル**: `e2e/profile/profile-display.spec.ts`
```typescript
test.describe('プロフィール表示', () => {
  test('プロフィールボタンからプロフィールページへ遷移できる', async ({ page }) => {
    // 検証内容:
    // 1. ダッシュボードのヘッダーのプロフィールボタンをクリック
    // 2. /profile ページへ遷移
    // 3. ユーザー情報が表示される
    // 4. アバター（イニシャル）が表示される
  });

  test('タブ切り替えが動作する', async ({ page }) => {
    // 検証内容:
    // 1. 「一般設定」タブをクリック
    // 2. 設定内容が表示される
    // 3. 「通知設定」タブをクリック
    // 4. 通知設定が表示される
    // 5. 「セキュリティ」タブをクリック
    // 6. セキュリティ設定が表示される
  });
});
```

### 6.2 プロフィール編集テスト
**ファイル**: `e2e/profile/profile-edit.spec.ts`
```typescript
test.describe('プロフィール編集', () => {
  test('プロフィール情報を更新できる', async ({ page }) => {
    // 検証内容:
    // 1. 表示名を変更
    // 2. 自己紹介を入力
    // 3. 電話番号、所在地、生年月日を入力
    // 4. 「変更を保存」ボタンをクリック
    // 5. 成功メッセージが表示される
    // 6. 変更内容が保持される
  });
});
```

### 6.3 設定変更テスト
**ファイル**: `e2e/profile/settings.spec.ts`
```typescript
test.describe('設定変更', () => {
  test('言語設定を変更できる', async ({ page }) => {
    // 検証内容:
    // 1. 「一般設定」タブで言語を英語に変更
    // 2. 「設定を保存」ボタンをクリック
    // 3. 設定が保持される
  });

  test('テーマを変更できる', async ({ page }) => {
    // 検証内容:
    // 1. ダークモードを選択
    // 2. 設定を保存
    // 3. テーマが適用される
  });

  test('自動翻訳設定をトグルできる', async ({ page }) => {
    // 検証内容:
    // 1. 自動翻訳スイッチをON
    // 2. 設定が保持される
  });

  test('通知設定を変更できる', async ({ page }) => {
    // 検証内容:
    // 1. 「通知設定」タブでメール通知をOFF
    // 2. プッシュ通知をON
    // 3. 通知カテゴリのチェックボックスを変更
    // 4. 設定が保持される
  });

  test('2段階認証を有効化できる', async ({ page }) => {
    // 検証内容:
    // 1. 「セキュリティ」タブで2段階認証をON
    // 2. 設定説明が表示される
  });
});
```

## 7. レスポンシブデザイン (Responsive Design)

### 7.1 モバイル表示テスト
**ファイル**: `e2e/responsive/mobile.spec.ts`
```typescript
test.describe('モバイル表示', () => {
  test('モバイルサイズでヘッダーが適切に表示される', async ({ page }) => {
    // 検証内容:
    // 1. ビューポートを375pxに設定
    // 2. ハンバーガーメニューや省略表示が適切
    // 3. ボタンのテキストが非表示でアイコンのみ表示
  });

  test('モバイルでプレビュー画面が使える', async ({ page }) => {
    // 検証内容:
    // 1. プレビュー画面が縦スクロール可能
    // 2. ボタンが適切に配置される
    // 3. テキスト内容が読みやすい
  });
});
```

### 7.2 タブレット表示テスト
**ファイル**: `e2e/responsive/tablet.spec.ts`
```typescript
test.describe('タブレット表示', () => {
  test('タブレットサイズで適切にレイアウトされる', async ({ page }) => {
    // 検証内容:
    // 1. ビューポートを768pxに設定
    // 2. サイドバーとメインコンテンツが適切に配置
    // 3. ボタンサイズが適切
  });
});
```

## 8. エラーハンドリング (Error Handling)

### 8.1 ネットワークエラーテスト
**ファイル**: `e2e/errors/network-errors.spec.ts`
```typescript
test.describe('ネットワークエラー', () => {
  test('API呼び出し失敗時にエラーメッセージが表示される', async ({ page }) => {
    // 検証内容:
    // 1. ネットワークをオフラインに設定
    // 2. 翻訳ボタンをクリック
    // 3. 「ネットワークエラーが発生しました」メッセージ
    // 4. リトライボタンが表示される
  });
});
```

### 8.2 認証エラーテスト
**ファイル**: `e2e/errors/auth-errors.spec.ts`
```typescript
test.describe('認証エラー', () => {
  test('セッション切れ時にログインページへリダイレクトされる', async ({ page }) => {
    // 検証内容:
    // 1. セッションを無効化
    // 2. 保護されたページにアクセス
    // 3. ログインページへリダイレクト
    // 4. 「セッションが切れました」メッセージが表示される
  });
});
```

## 9. パフォーマンステスト (Performance)

### 9.1 ページ読み込み速度テスト
**ファイル**: `e2e/performance/load-time.spec.ts`
```typescript
test.describe('ページ読み込み速度', () => {
  test('ダッシュボードが3秒以内に読み込まれる', async ({ page }) => {
    // 検証内容:
    // 1. パフォーマンスメトリクスを計測
    // 2. First Contentful Paint < 1.5秒
    // 3. Time to Interactive < 3秒
  });
});
```

### 9.2 大量データ処理テスト
**ファイル**: `e2e/performance/large-data.spec.ts`
```typescript
test.describe('大量データ処理', () => {
  test('100件のファイルがある場合でも正常に表示される', async ({ page }) => {
    // 検証内容:
    // 1. 100件のファイルを持つユーザーでログイン
    // 2. ダッシュボードが正常に表示される
    // 3. スクロールがスムーズ
    // 4. 検索・フィルタが動作する
  });

  test('50スライドのPPTXファイルを処理できる', async ({ page }) => {
    // 検証内容:
    // 1. 大きなPPTXファイルをアップロード
    // 2. プレビューが表示される
    // 3. スライドナビゲーションが動作する
    // 4. 翻訳が完了する
  });
});
```

## テスト実行設定

### Playwrightの設定ファイル
**ファイル**: `playwright.config.ts`
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### テストヘルパー関数
**ファイル**: `e2e/helpers/auth.ts`
```typescript
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard');
}

export async function logout(page: Page) {
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('/login');
}
```

**ファイル**: `e2e/helpers/file-upload.ts`
```typescript
export async function uploadFile(page: Page, filePath: string) {
  await page.goto('/upload');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.click('[data-testid="upload-button"]');
  await page.waitForURL(/\/preview\/.+/);
}
```

**ファイル**: `e2e/helpers/test-data.ts`
```typescript
export const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
};

export const TEST_FILES = {
  valid_pptx: 'e2e/fixtures/test-presentation.pptx',
  large_pptx: 'e2e/fixtures/large-presentation.pptx',
  invalid_file: 'e2e/fixtures/test.pdf',
};
```

## CI/CD統合

### GitHub Actionsワークフロー
**ファイル**: `.github/workflows/e2e.yml`
```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## テスト実行コマンド

```bash
# すべてのE2Eテストを実行
npm run test:e2e

# 特定のテストファイルを実行
npm run test:e2e auth/login.spec.ts

# デバッグモードで実行
npm run test:e2e:debug

# UIモードで実行
npm run test:e2e:ui

# 特定のブラウザでのみ実行
npm run test:e2e --project=chromium

# ヘッドレスモードを無効化
npm run test:e2e --headed

# 並列実行を無効化
npm run test:e2e --workers=1
```
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('ユーザージャーニー全体フロー', () => {
  test.beforeEach(async ({ page }) => {
    // テスト環境のベースURLを使用
    await page.goto('/');
  });

  test('新規ユーザーの登録から翻訳完了まで', async ({ page }) => {
    // 1. ランディングページの表示確認
    await expect(page.locator('h1')).toContainText('PowerPointを');
    await expect(page.locator('h1')).toContainText('瞬時に翻訳');
    
    // サブタイトルの確認
    await expect(page.locator('text=AIパワードの高精度翻訳でプレゼンテーションを世界へ')).toBeVisible();
    
    // 2. 登録ページへの遷移
    await page.click('text=無料で始める');
    await expect(page).toHaveURL(/\/register/);
    
    // 3. ユーザー登録
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.fill('input[name="confirmPassword"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // 4. ダッシュボードへのリダイレクト確認
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('ダッシュボード');
    
    // 5. ファイルアップロードモーダルを開く
    await page.click('text=新規アップロード');
    await expect(page.locator('text=ファイルをアップロード')).toBeVisible();
    
    // 6. テストファイルのアップロード
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.join(__dirname, 'fixtures', 'sample.pptx');
    await fileInput.setInputFiles(testFilePath);
    
    // アップロードボタンをクリック
    await page.click('button:has-text("アップロード")');
    
    // 7. アップロード成功の確認
    await expect(page.locator('text=ファイルが正常にアップロードされました')).toBeVisible({ timeout: 30000 });
    
    // モーダルを閉じる
    await page.click('button[aria-label="Close"]');
    
    // 8. ファイル一覧ページへの遷移
    await page.click('text=ファイル一覧');
    await expect(page).toHaveURL(/\/files/);
    
    // アップロードしたファイルの確認
    await expect(page.locator('text=sample.pptx')).toBeVisible();
    
    // 9. 翻訳の実行
    await page.click('button:has-text("翻訳")');
    
    // 翻訳設定モーダルの表示確認
    await expect(page.locator('text=翻訳設定')).toBeVisible();
    
    // ソース言語とターゲット言語の選択
    await page.selectOption('select[name="sourceLang"]', 'en');
    await page.selectOption('select[name="targetLang"]', 'ja');
    
    // 翻訳開始
    await page.click('button:has-text("翻訳を開始")');
    
    // 10. 翻訳進捗の確認
    await expect(page.locator('.progress-bar')).toBeVisible();
    await expect(page.locator('text=翻訳中')).toBeVisible();
    
    // 11. 翻訳完了の確認（時間がかかる可能性があるため長めのタイムアウト）
    await expect(page.locator('text=翻訳完了')).toBeVisible({ timeout: 60000 });
    
    // 12. ダウンロードボタンの確認
    await expect(page.locator('button:has-text("ダウンロード")')).toBeVisible();
  });

  test('既存ユーザーのログインとファイル操作', async ({ page }) => {
    // 1. ログインページへの遷移
    await page.click('text=ログイン');
    await expect(page).toHaveURL(/\/login/);
    
    // 2. ログイン
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');
    
    // 3. ダッシュボード表示確認
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // 4. ファイル一覧の確認
    await page.click('text=ファイル一覧');
    await expect(page).toHaveURL(/\/files/);
    
    // ファイルが表示されることを確認
    const fileRows = page.locator('tbody tr');
    const fileCount = await fileRows.count();
    
    if (fileCount > 0) {
      // 5. ファイルの削除操作
      await page.click('button:has-text("削除"):first');
      
      // 確認ダイアログ
      await page.click('text=確認');
      
      // 削除成功メッセージ
      await expect(page.locator('text=ファイルを削除しました')).toBeVisible();
    }
    
    // 6. ログアウト
    await page.click('button:has-text("ログアウト")');
    await expect(page).toHaveURL('/');
  });

  test('価格プランの確認と選択', async ({ page }) => {
    // 1. 価格セクションまでスクロール
    await page.locator('text=料金プラン').scrollIntoViewIfNeeded();
    
    // 2. 各プランの表示確認
    await expect(page.locator('text=Free')).toBeVisible();
    await expect(page.locator('text=¥0')).toBeVisible();
    await expect(page.locator('text=月10ファイルまで')).toBeVisible();
    
    await expect(page.locator('text=Pro')).toBeVisible();
    await expect(page.locator('text=¥2,980')).toBeVisible();
    await expect(page.locator('text=月100ファイルまで')).toBeVisible();
    
    await expect(page.locator('text=Enterprise')).toBeVisible();
    await expect(page.locator('text=お問い合わせ')).toBeVisible();
    await expect(page.locator('text=無制限のファイル数')).toBeVisible();
    
    // 3. Proプランの選択
    await page.click('a:has-text("Proを始める")');
    await expect(page).toHaveURL(/\/register\?plan=pro/);
    
    // プラン情報が引き継がれていることを確認
    await expect(page.locator('text=Proプラン')).toBeVisible();
  });

  test('機能セクションの確認', async ({ page }) => {
    // 1. 機能セクションまでスクロール
    await page.locator('text=主な機能').scrollIntoViewIfNeeded();
    
    // 2. 各機能の表示確認
    const features = [
      '多言語対応',
      '高速処理',
      'セキュア',
      'チーム共有',
      '24時間サポート',
      '高精度翻訳'
    ];
    
    for (const feature of features) {
      await expect(page.locator(`text=${feature}`)).toBeVisible();
    }
    
    // 3. 機能の説明文確認
    await expect(page.locator('text=/100以上の言語に対応/')).toBeVisible();
    await expect(page.locator('text=/AIによる数秒での翻訳/')).toBeVisible();
    await expect(page.locator('text=/エンタープライズグレードのセキュリティ/')).toBeVisible();
  });

  test('使い方セクションの確認', async ({ page }) => {
    // 1. 使い方セクションまでスクロール
    await page.locator('text=使い方').scrollIntoViewIfNeeded();
    
    // 2. 3ステップの表示確認
    await expect(page.locator('text=アップロード')).toBeVisible();
    await expect(page.locator('text=翻訳')).toBeVisible();
    await expect(page.locator('text=ダウンロード')).toBeVisible();
    
    // 3. 各ステップの説明確認
    await expect(page.locator('text=/PowerPointファイルをドラッグ＆ドロップまたは選択してアップロード/')).toBeVisible();
    await expect(page.locator('text=/翻訳したい言語を選択して翻訳開始。AIが自動で処理します/')).toBeVisible();
    await expect(page.locator('text=/翻訳完了後、すぐにダウンロード可能。元のレイアウトを保持/')).toBeVisible();
  });

  test('レスポンシブデザインの確認', async ({ page }) => {
    // 1. デスクトップビュー
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('button:has-text("メニュー")')).not.toBeVisible();
    
    // 2. タブレットビュー
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await expect(page.locator('h1')).toContainText('PowerPoint');
    
    // 3. モバイルビュー
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // モバイルメニューボタンの表示確認
    await expect(page.locator('button:has-text("メニュー")')).toBeVisible();
    
    // モバイルメニューを開く
    await page.click('button:has-text("メニュー")');
    await expect(page.locator('text=ホーム')).toBeVisible();
    await expect(page.locator('text=機能')).toBeVisible();
    await expect(page.locator('text=料金')).toBeVisible();
  });
});
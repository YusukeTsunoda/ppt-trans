import { test, expect } from '@playwright/test';
import { Config } from './config';
import { WaitUtils } from './utils/wait-utils';
import { join } from 'path';

/**
 * 翻訳機能の包括的E2Eテスト
 * コア機能のため最優先で実装
 */
test.describe('翻訳機能テスト', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');
  let fileId: string;

  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // ダッシュボードにアクセスして認証状態を確認
    await Config.safeNavigate(page, `${baseURL}/dashboard`);
    
    // ログインページにリダイレクトされていないことを確認
    const url = page.url();
    if (url.includes('/login')) {
      throw new Error('認証が正しく設定されていません。ログインページにリダイレクトされました。');
    }
    
    await WaitUtils.waitForAuthentication(page);

    // 新しいuploadFileメソッドを使用してファイルをアップロード
    await Config.uploadFile(page, testFilePath);
    
    // ファイルが表示されるのを待つ
    await page.waitForSelector('.bg-white:has-text("test-presentation.pptx")', { timeout: 10000 });
    
    // プレビューボタンを探す
    const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
    await expect(previewButton).toBeVisible({ timeout: 10000 });
    
    // プレビューページへの遷移（新しいヘルパーメソッドを使用）
    await Config.clickAndNavigate(page, 'a:has-text("📄 プレビュー")', /.*\/preview\/.*/);
    await WaitUtils.waitForAuthentication(page);
    
    // URLからファイルIDを取得
    const currentUrl = page.url();
    const match = currentUrl.match(/preview\/([^/]+)/);
    fileId = match ? match[1] : '';
    
    // テキスト抽出の完了を待つ
    // まずローディングが終わるのを待つ
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 30000 }
    );
    
    // slide-textが表示されるを待つ
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: 30000 
    });
    
    // 少なくとも1つのテキストが表示されていることを確認
    const slideTexts = page.locator('[data-testid="slide-text"]');
    await expect(slideTexts).toHaveCount(await slideTexts.count(), { timeout: 5000 });
    expect(await slideTexts.count()).toBeGreaterThan(0);
  });

  test.describe('単一スライド翻訳', () => {
    test('現在のスライドのみを翻訳できる', async ({ page }) => {
      // 言語選択（英語）
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // 現在のスライドを翻訳ボタンをクリック
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await expect(translateCurrentButton).toBeEnabled();
      
      // 翻訳APIレスポンスを待つ
      const translateResponsePromise = page.waitForResponse(
        response => response.url().includes('/api/translate') && response.status() === 200,
        { timeout: 30000 }
      );
      
      // ボタンをクリック
      await translateCurrentButton.click();
      
      // API呼び出しの完了を待つ
      const translateResponse = await translateResponsePromise;
      expect(translateResponse).toBeTruthy();
      
      // 翻訳完了を待つ（翻訳済みテキストまたは翻訳結果の表示）
      await page.waitForFunction(
        () => {
          // 翻訳済みインジケーターまたは翻訳結果が表示されているか確認
          const translatedIndicator = document.querySelector('.text-green-600');
          const translatedText = document.querySelector('[data-testid="translated-text"]');
          return translatedIndicator || translatedText;
        },
        { timeout: 30000 }
      );
      
      // 翻訳結果が表示されることを確認
      const translatedText = page.getByTestId('translated-text').first();
      await expect(translatedText).toBeVisible();
      await expect(translatedText).not.toBeEmpty();
      
      // ボタンが元に戻ることを確認
      await expect(translateCurrentButton).toHaveText('現在のスライドを翻訳');
      await expect(translateCurrentButton).toBeEnabled();
    });

    test('翻訳進捗が正しく表示される', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // 進捗メッセージの確認
      const progressMessage = page.locator('text=/翻訳中.*\d+\/\d+/');
      await expect(progressMessage).toBeVisible();
      
      // パーセンテージ表示の確認
      const percentageText = page.locator('text=/\d+%/');
      await expect(percentageText).toBeVisible();
      
      // 進捗バーのアニメーション確認
      const progressBar = page.getByRole('progressbar');
      const initialValue = await progressBar.getAttribute('aria-valuenow');
      
      // 進捗が進むのを待つ
      await page.waitForTimeout(1000);
      
      const updatedValue = await progressBar.getAttribute('aria-valuenow');
      expect(parseInt(updatedValue || '0')).toBeGreaterThanOrEqual(parseInt(initialValue || '0'));
    });
  });

  test.describe('全スライド一括翻訳', () => {
    test('すべてのスライドを一括翻訳できる', async ({ page }) => {
      // 言語選択（英語）
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // すべて翻訳ボタンをクリック
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await expect(translateAllButton).toBeEnabled();
      await translateAllButton.click();
      
      // ボタンが「翻訳中...」に変わることを確認
      await expect(translateAllButton).toHaveText(/翻訳中\.\.\./);
      await expect(translateAllButton).toBeDisabled();
      
      // バッチ処理のメッセージ確認（例: "翻訳中... (1-10/20)")
      const batchMessage = page.locator('text=/翻訳中.*\(\d+-\d+\/\d+\)/');
      await expect(batchMessage).toBeVisible();
      
      // 翻訳完了メッセージを待つ
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      // 複数のスライドに翻訳済みマークが付くことを確認
      const translatedSlides = page.locator('.bg-green-100').filter({ hasText: '✓' });
      const count = await translatedSlides.count();
      expect(count).toBeGreaterThan(0);
      
      // 2番目のスライドに移動して翻訳を確認
      const nextButton = page.getByLabel('次のスライド');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
        
        const translatedTextSlide2 = page.getByTestId('translated-text').first();
        await expect(translatedTextSlide2).toBeVisible();
      }
    });

    test('APIレート制限が考慮される', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      
      // 翻訳開始時刻を記録
      const startTime = Date.now();
      await translateAllButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // バッチ処理にウェイトが入っているか確認（最低でも500ms×バッチ数）
      expect(duration).toBeGreaterThan(500); // 少なくとも1回のウェイト
    });
  });

  test.describe('翻訳言語選択', () => {
    test('異なる言語への翻訳ができる', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      
      // 中国語への翻訳
      await languageSelect.selectOption('zh');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      const chineseTranslation = await page.getByTestId('translated-text').first().textContent();
      expect(chineseTranslation).toBeTruthy();
      
      // 韓国語への翻訳（再翻訳）
      await languageSelect.selectOption('ko');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 30000 
      });
      
      const koreanTranslation = await page.getByTestId('translated-text').first().textContent();
      expect(koreanTranslation).toBeTruthy();
      expect(koreanTranslation).not.toBe(chineseTranslation);
    });

    test('言語選択が保持される', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      
      // フランス語を選択
      await languageSelect.selectOption('fr');
      
      // ページをリロード
      await page.reload();
      
      // テキスト抽出完了を待つ
      await expect(page.locator('[data-testid="slide-text"]').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 選択が保持されているか確認
      const selectedValue = await languageSelect.inputValue();
      expect(selectedValue).toBe('fr');
    });
  });

  test.describe('翻訳エラーハンドリング', () => {
    test('翻訳APIエラー時の適切な表示', async ({ page, context }) => {
      // APIエラーをシミュレート（ネットワークをブロック）
      await context.route('**/api/translate', route => {
        route.abort('failed');
      });
      
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // エラーメッセージが表示される
      const errorMessage = page.locator('.bg-red-50').or(page.locator('text=/翻訳.*失敗/'));
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
      
      // ボタンが元に戻る
      await expect(translateCurrentButton).toHaveText('現在のスライドを翻訳');
      await expect(translateCurrentButton).toBeEnabled();
      
      // 進捗バーが消える
      const progressBar = page.getByRole('progressbar');
      await expect(progressBar).not.toBeVisible();
    });

    test('翻訳中の他操作制限', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // 全スライド翻訳を開始
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      // 翻訳中は他の翻訳ボタンが無効化される
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await expect(translateCurrentButton).toBeDisabled();
      
      // ダウンロードボタンも翻訳中は無効化される可能性
      const downloadButton = page.locator('button:has-text("ダウンロード")');
      if (await downloadButton.isVisible()) {
        // 翻訳中はダウンロードできないことを確認
        const isDisabled = await downloadButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    });
  });

  test.describe('翻訳済みテキストの状態管理', () => {
    test('翻訳済みマークが正しく表示される', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 翻訳済みインジケーターの確認
      const translatedIndicator = page.locator('.text-green-600').filter({ hasText: '翻訳済み' });
      await expect(translatedIndicator.first()).toBeVisible();
      
      // サムネイルのチェックマーク確認
      const thumbnailCheck = page.locator('.bg-green-500').filter({ hasText: '✓' });
      const checkCount = await thumbnailCheck.count();
      expect(checkCount).toBeGreaterThan(0);
    });

    test('スライド切り替え時も翻訳が保持される', async ({ page }) => {
      // 最初のスライドを翻訳
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      const firstSlideTranslation = await page.getByTestId('translated-text').first().textContent();
      
      // 次のスライドへ移動
      const nextButton = page.getByLabel('次のスライド');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
        
        // 前のスライドに戻る
        const prevButton = page.getByLabel('前のスライド');
        await prevButton.click();
        await page.waitForTimeout(500);
        
        // 翻訳が保持されているか確認
        const restoredTranslation = await page.getByTestId('translated-text').first().textContent();
        expect(restoredTranslation).toBe(firstSlideTranslation);
      }
    });
  });
});
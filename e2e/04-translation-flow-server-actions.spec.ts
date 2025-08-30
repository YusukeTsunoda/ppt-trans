import { test, expect } from '@playwright/test';
import { Config } from './config';
import { WaitUtils } from './utils/wait-utils';
import { join } from 'path';

/**
 * 翻訳機能のServer Actions E2Eテスト
 * Server Actionsを通じた翻訳処理をテスト
 */
test.describe('翻訳機能テスト（Server Actions版）', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');
  let fileId: string;

  test.beforeEach(async ({ page, baseURL }) => {
    // 認証済み状態でダッシュボードにアクセス
    await Config.safeNavigate(page, `${baseURL}/dashboard`);
    
    // ログインが必要な場合はログイン
    const url = page.url();
    if (url.includes('/login')) {
      await Config.login(page);
    }
    
    await WaitUtils.waitForAuthentication(page);

    // ファイルをアップロード（Server Action経由）
    await Config.uploadFile(page, testFilePath);
    
    // ファイルが表示されるのを待つ
    await page.waitForSelector('.bg-white:has-text("test-presentation.pptx")', { timeout: 10000 });
    
    // プレビューページへ遷移
    await Config.clickAndNavigate(page, 'a:has-text("📄 プレビュー")', /.*\/preview\/.*/);
    await WaitUtils.waitForAuthentication(page);
    
    // URLからファイルIDを取得
    const currentUrl = page.url();
    const match = currentUrl.match(/preview\/([^/]+)/);
    fileId = match ? match[1] : '';
    
    // テキスト抽出の完了を待つ
    await page.waitForFunction(
      () => !document.querySelector('.animate-spin'),
      { timeout: 30000 }
    );
    
    await page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: 30000 
    });
  });

  test.describe('Server Action経由の翻訳実行', () => {
    test('現在のスライドをServer Actionで翻訳', async ({ page }) => {
      // 言語選択
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // 翻訳ボタンを探す（Server Actionが設定されているはず）
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await expect(translateButton).toBeEnabled();
      
      // ボタンの親フォームを確認
      const translateForm = await translateButton.locator('xpath=ancestor::form').first();
      const hasForm = await translateForm.count() > 0;
      
      if (hasForm) {
        // フォームのaction属性を確認
        const formAction = await translateForm.getAttribute('action');
        console.log('Translation form action:', formAction);
      }
      
      // Server Action実行前の状態を記録
      const buttonTextBefore = await translateButton.textContent();
      
      // Server Actionを実行
      await translateButton.click();
      
      // ボタンが無効化されることを確認
      await expect(translateButton).toBeDisabled({ timeout: 1000 });
      
      // 進捗表示を確認
      const progressMessage = page.locator('text=/翻訳中/');
      await expect(progressMessage).toBeVisible({ timeout: 2000 });
      
      // 翻訳完了を待つ（Server Action完了）
      await page.waitForFunction(
        () => {
          const indicator = document.querySelector('.text-green-600');
          const translatedText = document.querySelector('[data-testid="translated-text"]');
          return indicator || translatedText;
        },
        { timeout: 30000 }
      );
      
      // 翻訳結果が表示されることを確認
      const translatedText = page.getByTestId('translated-text').first();
      await expect(translatedText).toBeVisible();
      await expect(translatedText).not.toBeEmpty();
      
      // ボタンが再度有効になることを確認
      await expect(translateButton).toBeEnabled();
      await expect(translateButton).toHaveText('現在のスライドを翻訳');
    });

    test('すべてのスライドをServer Actionで一括翻訳', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // すべて翻訳ボタン（Server Action）
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await expect(translateAllButton).toBeEnabled();
      
      // Server Action実行
      await translateAllButton.click();
      
      // ボタンが無効化され、進捗表示に変わることを確認
      await expect(translateAllButton).toBeDisabled();
      await expect(translateAllButton).toHaveText(/翻訳中\.\.\./);
      
      // バッチ処理の進捗メッセージ
      const batchMessage = page.locator('text=/翻訳中.*\(\d+-\d+\/\d+\)/');
      await expect(batchMessage).toBeVisible({ timeout: 3000 });
      
      // 翻訳完了メッセージを待つ
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 60000 
      });
      
      // 複数のスライドに翻訳済みマークが付くことを確認
      const translatedSlides = page.locator('.bg-green-100').filter({ hasText: '✓' });
      const count = await translatedSlides.count();
      expect(count).toBeGreaterThan(0);
      
      // ボタンが元に戻ることを確認
      await expect(translateAllButton).toBeEnabled();
      await expect(translateAllButton).toHaveText('すべて翻訳');
    });
  });

  test.describe('Server Action経由の言語切り替え', () => {
    test('異なる言語へのServer Action翻訳', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      
      // 中国語への翻訳
      await languageSelect.selectOption('zh');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      const chineseTranslation = await page.getByTestId('translated-text').first().textContent();
      expect(chineseTranslation).toBeTruthy();
      
      // 韓国語への再翻訳（Server Action経由）
      await languageSelect.selectOption('ko');
      await translateButton.click();
      
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 30000 
      });
      
      const koreanTranslation = await page.getByTestId('translated-text').first().textContent();
      expect(koreanTranslation).toBeTruthy();
      expect(koreanTranslation).not.toBe(chineseTranslation);
    });

    test('言語選択の永続性（Server Action後）', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      
      // フランス語を選択
      await languageSelect.selectOption('fr');
      
      // Server Action実行
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
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

  test.describe('Server Actionエラーハンドリング', () => {
    test('Server Action翻訳エラーの適切な処理', async ({ page, context }) => {
      // 翻訳APIエラーをシミュレート
      await context.route('**/api/translate', route => {
        route.abort('failed');
      });
      
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // エラーメッセージが表示される
      const errorMessage = page.locator('.bg-red-50, .text-red-600').first();
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      
      // ボタンが元に戻る
      await expect(translateButton).toHaveText('現在のスライドを翻訳');
      await expect(translateButton).toBeEnabled();
    });

    test('Server Action実行中の操作制限', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // 全スライド翻訳を開始
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      // 翻訳中は他の翻訳ボタンが無効化される
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await expect(translateCurrentButton).toBeDisabled();
      
      // 言語選択も無効化されるかを確認
      const isSelectDisabled = await languageSelect.isDisabled();
      console.log('Language select disabled during translation:', isSelectDisabled);
    });

    test('Server Actionのネットワークエラー処理', async ({ page, context }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // オフラインモードに設定
      await context.setOffline(true);
      
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // ネットワークエラーメッセージを確認
      const errorMessage = page.locator('text=/ネットワーク|接続|Connection/');
      await expect(errorMessage).toBeVisible({ timeout: 10000 });
      
      // オンラインに戻す
      await context.setOffline(false);
      
      // ボタンが再度有効になることを確認
      await expect(translateButton).toBeEnabled();
    });
  });

  test.describe('Server Actionの状態管理', () => {
    test('翻訳済み状態のServer Action同期', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      const translateButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 翻訳済みインジケーターの確認
      const translatedIndicator = page.locator('.text-green-600').filter({ hasText: '翻訳済み' });
      await expect(translatedIndicator.first()).toBeVisible();
      
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
        
        // 翻訳が保持されているか確認（Server Actionの状態管理）
        const restoredTranslation = await page.getByTestId('translated-text').first().textContent();
        expect(restoredTranslation).toBe(firstSlideTranslation);
      }
    });

    test('並行Server Action実行の防止', async ({ page }) => {
      const languageSelect = page.getByLabel('翻訳先言語');
      await languageSelect.selectOption('en');
      
      // 現在のスライド翻訳を開始
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // すぐに全体翻訳を試みる
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      
      // 全体翻訳ボタンが無効化されていることを確認
      await expect(translateAllButton).toBeDisabled({ timeout: 1000 });
      
      // 現在の翻訳が完了するまで待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 完了後は全体翻訳が可能になる
      await expect(translateAllButton).toBeEnabled();
    });
  });

  test.describe('Server Actionのレート制限', () => {
    test('APIレート制限を考慮したServer Action実行', async ({ page }) => {
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
      
      // Server Actionがレート制限を考慮していることを確認
      // バッチ処理にウェイトが入っているか
      expect(duration).toBeGreaterThan(500);
      console.log(`Translation took ${duration}ms with rate limiting`);
    });
  });
});
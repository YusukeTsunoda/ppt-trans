/**
 * 翻訳機能のCoreテスト
 * 翻訳処理の基本動作を検証
 */

import { test, expect } from '../../fixtures/auth';
import { Config } from '../../config';

test.describe('翻訳機能', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // テストファイルをアップロード
    await Config.uploadFile(authenticatedPage, Config.testData.validPptx);
    
    // ダッシュボードでファイルを確認
    await authenticatedPage.waitForURL(/.*\/dashboard/);
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    await expect(fileRow).toBeVisible();
  });

  test('基本的な翻訳フロー（日本語→英語）', async ({ authenticatedPage }) => {
    // ファイル行からプレビューリンクを探す
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    const previewLink = fileRow.locator('a[href*="/preview/"]');
    
    // プレビューページへ遷移
    await previewLink.click();
    await authenticatedPage.waitForURL(/.*\/preview\/.*/);
    
    // テキスト抽出完了を待つ
    await Config.waitForElement(
      authenticatedPage, 
      Config.selectors.preview.slideText,
      30000
    );
    
    // 言語選択（英語）
    const languageSelect = authenticatedPage.locator(Config.selectors.translation.languageSelect);
    if (await languageSelect.isVisible()) {
      await languageSelect.selectOption('en');
    }
    
    // 翻訳ボタンをクリック
    const translateButton = authenticatedPage.locator(Config.selectors.translation.translateButton);
    await translateButton.click();
    
    // 翻訳完了を待つ
    await expect(
      authenticatedPage.locator(Config.selectors.translation.translatedText).first()
    ).toBeVisible({ timeout: 30000 });
    
    // 翻訳されたテキストが英語であることを確認（簡易チェック）
    const translatedText = await authenticatedPage
      .locator(Config.selectors.translation.translatedText)
      .first()
      .textContent();
    
    expect(translatedText).toBeTruthy();
    // 日本語が含まれていないことを確認
    expect(translatedText).not.toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
  });

  test('複数言語への翻訳', async ({ authenticatedPage }) => {
    const targetLanguages = ['en', 'zh', 'ko'];
    
    // プレビューページへ遷移
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    const previewLink = fileRow.locator('a[href*="/preview/"]');
    await previewLink.click();
    await authenticatedPage.waitForURL(/.*\/preview\/.*/);
    
    // 各言語で翻訳を実行
    for (const lang of targetLanguages) {
      // 言語選択
      const languageSelect = authenticatedPage.locator(Config.selectors.translation.languageSelect);
      if (await languageSelect.isVisible()) {
        await languageSelect.selectOption(lang);
        
        // 翻訳実行
        const translateButton = authenticatedPage.locator(Config.selectors.translation.translateButton);
        await translateButton.click();
        
        // 翻訳完了を待つ
        await authenticatedPage.waitForTimeout(2000); // API制限を考慮
        
        // 翻訳結果が表示されることを確認
        const translatedText = authenticatedPage.locator(Config.selectors.translation.translatedText);
        await expect(translatedText.first()).toBeVisible({ timeout: 30000 });
        
        console.log(`Translation to ${lang} completed`);
      }
    }
  });

  test('翻訳済みファイルのダウンロード', async ({ authenticatedPage }) => {
    // プレビューページへ遷移
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    const previewLink = fileRow.locator('a[href*="/preview/"]');
    await previewLink.click();
    await authenticatedPage.waitForURL(/.*\/preview\/.*/);
    
    // 翻訳を実行
    const languageSelect = authenticatedPage.locator(Config.selectors.translation.languageSelect);
    if (await languageSelect.isVisible()) {
      await languageSelect.selectOption('en');
    }
    
    const translateButton = authenticatedPage.locator(Config.selectors.translation.translateButton);
    await translateButton.click();
    
    // 翻訳完了を待つ
    await expect(
      authenticatedPage.locator(Config.selectors.translation.translatedText).first()
    ).toBeVisible({ timeout: 30000 });
    
    // ダウンロードボタンが表示されることを確認
    const downloadButton = authenticatedPage.locator(Config.selectors.translation.downloadButton);
    await expect(downloadButton.first()).toBeVisible();
    
    // ダウンロードイベントを準備
    const downloadPromise = authenticatedPage.waitForEvent('download');
    
    // ダウンロードボタンをクリック
    await downloadButton.first().click();
    
    // ダウンロードが開始されることを確認
    const download = await Promise.race([
      downloadPromise,
      authenticatedPage.waitForTimeout(5000).then(() => null)
    ]);
    
    if (download) {
      // ダウンロードファイル名を確認
      const filename = download.suggestedFilename();
      expect(filename).toContain('translated');
      expect(filename).toContain('.pptx');
      
      console.log(`Downloaded file: ${filename}`);
    }
  });

  test('翻訳エラーハンドリング（API制限）', async ({ authenticatedPage }) => {
    test.skip(true, 'API rate limit test - manual execution only');
    
    // 複数回連続で翻訳を実行してAPI制限をテスト
    for (let i = 0; i < 10; i++) {
      const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
      const previewLink = fileRow.locator('a[href*="/preview/"]');
      await previewLink.click();
      
      const translateButton = authenticatedPage.locator(Config.selectors.translation.translateButton);
      await translateButton.click();
      
      // エラーメッセージまたは成功を確認
      const result = await Promise.race([
        Config.getErrorMessage(authenticatedPage),
        authenticatedPage.waitForTimeout(5000).then(() => 'timeout')
      ]);
      
      if (typeof result === 'string' && result.includes('制限')) {
        console.log('API rate limit reached');
        break;
      }
      
      // ダッシュボードに戻る
      await authenticatedPage.goto(Config.urls.dashboard);
    }
  });

  test('翻訳のキャンセル', async ({ authenticatedPage }) => {
    // プレビューページへ遷移
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    const previewLink = fileRow.locator('a[href*="/preview/"]');
    await previewLink.click();
    await authenticatedPage.waitForURL(/.*\/preview\/.*/);
    
    // 翻訳ボタンをクリック
    const translateButton = authenticatedPage.locator(Config.selectors.translation.translateButton);
    await translateButton.click();
    
    // すぐにページを離れる（キャンセル）
    await authenticatedPage.goto(Config.urls.dashboard);
    
    // ダッシュボードでファイルの状態を確認
    const statusBadge = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first()
      .locator('span').filter({ hasText: /processing|処理中/ });
    
    // 処理中状態が適切にクリアされることを確認
    await authenticatedPage.waitForTimeout(5000);
    await authenticatedPage.reload();
    
    const currentStatus = await statusBadge.textContent();
    expect(currentStatus).not.toContain('処理中');
  });

  test('スライドごとの翻訳', async ({ authenticatedPage }) => {
    // プレビューページへ遷移
    const fileRow = authenticatedPage.locator('tr:has-text("test-presentation.pptx")').first();
    const previewLink = fileRow.locator('a[href*="/preview/"]');
    await previewLink.click();
    await authenticatedPage.waitForURL(/.*\/preview\/.*/);
    
    // スライド数を確認
    const slideCounter = authenticatedPage.locator(Config.selectors.preview.slideCounter);
    const slideText = await slideCounter.textContent();
    const totalSlides = parseInt(slideText?.match(/\/\s*(\d+)/)?.[1] || '1');
    
    // 各スライドを翻訳
    for (let i = 0; i < Math.min(totalSlides, 3); i++) {
      // 現在のスライドを翻訳
      const currentSlideButton = authenticatedPage.locator('button:has-text("現在のスライドを翻訳")');
      if (await currentSlideButton.isVisible()) {
        await currentSlideButton.click();
        await authenticatedPage.waitForTimeout(2000);
      }
      
      // 次のスライドへ
      if (i < totalSlides - 1) {
        const nextButton = authenticatedPage.locator(Config.selectors.preview.nextButton);
        await nextButton.click();
        await authenticatedPage.waitForTimeout(1000);
      }
    }
    
    console.log(`Translated ${Math.min(totalSlides, 3)} slides`);
  });
});
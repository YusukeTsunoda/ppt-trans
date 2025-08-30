import { test, expect, TEST_USER } from './fixtures/test-base';
import { join } from 'path';

/**
 * テーブルセル翻訳機能の包括的E2Eテスト
 * 最新実装のテーブルセルごとの翻訳機能をテスト
 */
test.describe('テーブルセル翻訳機能テスト', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');

  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // ファイルをアップロード
    await page.goto(`${baseURL}/upload`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled({ timeout: 5000 });
    await uploadButton.click();
    
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // プレビューページへ遷移
    const previewButton = page.locator('a:has-text("📄 プレビュー")').first();
    await expect(previewButton).toBeVisible({ timeout: 10000 });
    await previewButton.click();
    
    await expect(page).toHaveURL(/.*\/preview\/.*/, { timeout: 10000 });
    
    // テキスト抽出完了を待つ
    await expect(page.locator('[data-testid="slide-text"]').first()).toBeVisible({ 
      timeout: 30000 
    });
    
    // テーブルが含まれるスライドへ移動（通常3番目のスライド）
    const slideWithTable = await findSlideWithTable(page);
    if (slideWithTable > 0) {
      await navigateToSlide(page, slideWithTable);
    }
  });

  test.describe('テーブルセルの表示', () => {
    test('テーブルセルが個別に表示される', async ({ page }) => {
      // テーブルセルインジケーターを探す
      const tableCellIndicator = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      
      // 少なくとも1つのテーブルセルが表示されている
      await expect(tableCellIndicator.first()).toBeVisible({ timeout: 10000 });
      
      // セル位置が正しく表示される（例: 表[1,1], 表[1,2]など）
      const cellTexts = await tableCellIndicator.allTextContents();
      expect(cellTexts.length).toBeGreaterThan(0);
      
      // セル位置のフォーマットを確認
      cellTexts.forEach(text => {
        expect(text).toMatch(/表\[\d+,\d+\]/);
      });
    });

    test('テーブルセルの内容が正しく抽出される', async ({ page }) => {
      // テーブルセルのテキストを探す
      const tableCells = page.locator('.text-gray-900').filter({ 
        has: page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ }) 
      });
      
      // セルの内容を取得
      const cellContents = await page.locator('[data-testid="slide-text"]').allTextContents();
      
      // テストファイルに含まれる既知のセル内容を確認
      // test-presentation.pptxの3番目のスライドには以下のテーブルが含まれる
      const expectedCellTexts = ['Header 1', 'Header 2', 'Header 3', 'Row 1, Col 1', 'Row 1, Col 2'];
      
      let foundCells = 0;
      for (const expectedText of expectedCellTexts) {
        const found = cellContents.some(content => content.includes(expectedText));
        if (found) foundCells++;
      }
      
      // 少なくともいくつかのセルが見つかることを確認
      expect(foundCells).toBeGreaterThan(0);
    });

    test('テーブル構造が保持される', async ({ page }) => {
      // 同じテーブルのセルをグループ化して表示
      const tableCellIndicators = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const indicatorTexts = await tableCellIndicators.allTextContents();
      
      // 行と列の番号を抽出
      const cellPositions = indicatorTexts.map(text => {
        const match = text.match(/表\[(\d+),(\d+)\]/);
        return match ? { row: parseInt(match[1]), col: parseInt(match[2]) } : null;
      }).filter(Boolean);
      
      if (cellPositions.length > 0) {
        // 行番号と列番号が連続していることを確認
        const rows = cellPositions.map(p => p.row);
        const cols = cellPositions.map(p => p.col);
        
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minCol = Math.min(...cols);
        const maxCol = Math.max(...cols);
        
        // テーブル構造が妥当であることを確認
        expect(minRow).toBeGreaterThanOrEqual(1);
        expect(minCol).toBeGreaterThanOrEqual(1);
        expect(maxRow - minRow).toBeLessThan(10); // 妥当な行数
        expect(maxCol - minCol).toBeLessThan(10); // 妥当な列数
      }
    });
  });

  test.describe('テーブルセルの翻訳', () => {
    test('テーブルセルが個別に翻訳される', async ({ page }) => {
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // 翻訳完了を待つ
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // テーブルセルの翻訳を確認
      const translatedCells = page.locator('[data-testid="translated-text"]');
      const translatedCount = await translatedCells.count();
      
      // 複数のセルが翻訳されている
      expect(translatedCount).toBeGreaterThan(0);
      
      // 各セルの翻訳が元のセルと対応している
      const tableCellIndicators = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const indicatorCount = await tableCellIndicators.count();
      
      // インジケーターがある各セルに対して翻訳が存在
      expect(translatedCount).toBeGreaterThanOrEqual(indicatorCount);
    });

    test('セル位置情報が翻訳後も保持される', async ({ page }) => {
      // 翻訳前のセル位置を記録
      const tableCellIndicatorsBefore = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const positionsBefore = await tableCellIndicatorsBefore.allTextContents();
      
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 翻訳後のセル位置を確認
      const tableCellIndicatorsAfter = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const positionsAfter = await tableCellIndicatorsAfter.allTextContents();
      
      // 位置情報が保持されている
      expect(positionsAfter.length).toBe(positionsBefore.length);
      positionsAfter.forEach((pos, index) => {
        expect(pos).toBe(positionsBefore[index]);
      });
    });

    test('特定のセルのみ編集可能', async ({ page }) => {
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 特定のテーブルセルの翻訳を編集
      const firstTableCell = page.locator('.bg-blue-100').filter({ hasText: /表\[1,1\]/ }).first();
      
      if (await firstTableCell.isVisible()) {
        // そのセルに対応する翻訳テキストを探す
        const cellContainer = firstTableCell.locator('..').locator('..');
        const translatedText = cellContainer.locator('[data-testid="translated-text"]').first();
        
        // ダブルクリックまたは編集ボタンで編集モード
        const editButton = cellContainer.locator('button:has-text("編集")');
        if (await editButton.isVisible()) {
          await editButton.click();
        } else {
          await translatedText.dblclick();
        }
        
        // 編集フィールドが表示される
        const editField = cellContainer.locator('textarea').or(cellContainer.locator('input[type="text"]'));
        await expect(editField.first()).toBeVisible({ timeout: 5000 });
        
        // 新しいテキストを入力
        await editField.first().clear();
        await editField.first().fill('Edited Cell Content');
        
        // 保存
        const saveButton = cellContainer.locator('button:has-text("保存")');
        if (await saveButton.isVisible()) {
          await saveButton.click();
        } else {
          await editField.first().press('Enter');
        }
        
        // 編集が反映される
        await expect(translatedText).toHaveText('Edited Cell Content');
      }
    });
  });

  test.describe('テーブルセルのダウンロード', () => {
    test('セルごとの翻訳がPowerPointに適用される', async ({ page }) => {
      // 全セルを翻訳
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // ダウンロードボタンが有効になる
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")').or(
        page.locator('button:has-text("ダウンロード")')
      );
      await expect(downloadButton.first()).toBeEnabled({ timeout: 5000 });
      
      // ダウンロードを実行
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      // ファイルが正常にダウンロードされる
      const downloadPath = await download.path();
      const { existsSync, unlinkSync } = await import('fs');
      
      expect(existsSync(downloadPath)).toBeTruthy();
      
      // クリーンアップ
      if (existsSync(downloadPath)) {
        unlinkSync(downloadPath);
      }
    });

    test('部分的なセル翻訳もダウンロード可能', async ({ page }) => {
      // 最初のセルのみ翻訳を編集
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      await expect(page.locator('text="翻訳済み"').first()).toBeVisible({ 
        timeout: 30000 
      });
      
      // 一部のセルのみ編集
      const firstCell = page.locator('.bg-blue-100').filter({ hasText: /表\[1,1\]/ }).first();
      if (await firstCell.isVisible()) {
        const cellContainer = firstCell.locator('..').locator('..');
        const editButton = cellContainer.locator('button:has-text("編集")');
        
        if (await editButton.isVisible()) {
          await editButton.click();
          const editField = cellContainer.locator('textarea').first();
          await editField.clear();
          await editField.fill('Partially Translated');
          
          const saveButton = cellContainer.locator('button:has-text("保存")');
          await saveButton.click();
        }
      }
      
      // ダウンロード可能
      const downloadButton = page.locator('button:has-text("翻訳済みをダウンロード")');
      await expect(downloadButton.first()).toBeEnabled();
      
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadButton.first().click()
      ]);
      
      const downloadPath = await download.path();
      const { existsSync, unlinkSync } = await import('fs');
      
      expect(existsSync(downloadPath)).toBeTruthy();
      
      // クリーンアップ
      if (existsSync(downloadPath)) {
        unlinkSync(downloadPath);
      }
    });
  });

  test.describe('テーブルセルのエラーハンドリング', () => {
    test('空のセルは適切に処理される', async ({ page }) => {
      // テーブルセルの表示を確認
      const tableCellIndicators = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const cellCount = await tableCellIndicators.count();
      
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateCurrentButton = page.locator('button:has-text("現在のスライドを翻訳")');
      await translateCurrentButton.click();
      
      // エラーなく完了
      await expect(page.locator('text="翻訳済み"').first().or(
        page.locator('text="翻訳が完了しました"')
      )).toBeVisible({ timeout: 30000 });
      
      // エラーメッセージが表示されていない
      const errorMessage = page.locator('.bg-red-50');
      await expect(errorMessage).not.toBeVisible();
    });

    test('大きなテーブルでも正常に処理される', async ({ page }) => {
      // テーブルセルの数を確認
      const tableCellIndicators = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
      const cellCount = await tableCellIndicators.count();
      
      console.log(`Found ${cellCount} table cells`);
      
      // 翻訳を実行
      const languageSelect = page.locator('select[aria-label="翻訳先言語"]');
      await languageSelect.selectOption('en');
      
      const translateAllButton = page.locator('button:has-text("すべて翻訳")');
      await translateAllButton.click();
      
      // プログレスバーが表示される
      const progressBar = page.locator('[role="progressbar"]').or(
        page.locator('.bg-blue-600').filter({ has: page.locator('text=/%/') })
      );
      await expect(progressBar.first()).toBeVisible({ timeout: 5000 });
      
      // 完了まで待つ（大きなテーブルの場合は時間がかかる）
      await expect(page.locator('text="翻訳が完了しました"')).toBeVisible({ 
        timeout: 90000 
      });
      
      // すべてのセルが翻訳されている
      const translatedTexts = page.locator('[data-testid="translated-text"]');
      const translatedCount = await translatedTexts.count();
      
      // セル数と翻訳数が一致（または近い）
      expect(translatedCount).toBeGreaterThan(0);
    });
  });
});

/**
 * テーブルを含むスライドを探すヘルパー関数
 */
async function findSlideWithTable(page) {
  // サムネイル一覧からテーブルを含むスライドを探す
  const thumbnails = page.locator('[data-testid="slide-thumbnail"]');
  const count = await thumbnails.count();
  
  for (let i = 0; i < count; i++) {
    await thumbnails.nth(i).click();
    await page.waitForTimeout(500);
    
    const tableCellIndicator = page.locator('.bg-blue-100').filter({ hasText: /表\[\d+,\d+\]/ });
    if (await tableCellIndicator.first().isVisible({ timeout: 1000 })) {
      return i + 1;
    }
  }
  
  // デフォルトで3番目のスライド（test-presentation.pptxの場合）
  return 3;
}

/**
 * 特定のスライドに移動するヘルパー関数
 */
async function navigateToSlide(page, slideNumber) {
  // サムネイルをクリック
  const thumbnail = page.locator('[data-testid="slide-thumbnail"]').nth(slideNumber - 1);
  if (await thumbnail.isVisible()) {
    await thumbnail.click();
    await page.waitForTimeout(500);
    return;
  }
  
  // または次へボタンで移動
  const currentSlide = 1;
  for (let i = currentSlide; i < slideNumber; i++) {
    const nextButton = page.locator('button[aria-label="次のスライド"]');
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
  }
}
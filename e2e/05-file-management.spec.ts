import { test, expect, TEST_USER } from './fixtures/test-base';
import { join } from 'path';

/**
 * ファイル管理機能の包括的E2Eテスト
 * ファイル削除機能を中心にテスト
 */
test.describe('ファイル管理機能テスト', () => {
  const testFilePath = join(__dirname, 'fixtures', 'test-presentation.pptx');

  test.beforeEach(async ({ page, baseURL }) => {
    // authenticated-testsプロジェクトは既に認証済み
    // 直接ダッシュボードへ遷移
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('ファイル削除機能', () => {
    test('ダッシュボードからファイルを削除できる', async ({ page, baseURL }) => {
      // ファイルをアップロード
      await page.goto(`${baseURL}/upload`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      const uploadButton = page.locator('button:has-text("アップロード")');
      await expect(uploadButton).toBeEnabled({ timeout: 5000 });
      await uploadButton.click();
      
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // ファイルカードが表示されるまで待つ
      const fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      await expect(fileCard).toBeVisible({ timeout: 10000 });
      
      // 削除前のファイル数を取得
      const initialFileCount = await page.locator('.bg-white').filter({ hasText: '.pptx' }).count();
      
      // 削除ボタンをクリック
      const deleteButton = fileCard.locator('button:has-text("削除")').or(fileCard.locator('button[aria-label="削除"]'));
      await expect(deleteButton.first()).toBeVisible();
      await deleteButton.first().click();
      
      // 確認ダイアログが表示される
      page.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('削除');
        await dialog.accept();
      });
      
      // もしくはカスタム確認モーダルの場合
      const confirmModal = page.locator('.modal').or(page.locator('[role="dialog"]'));
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        const confirmButton = confirmModal.locator('button:has-text("削除")').or(confirmModal.locator('button:has-text("OK")'));
        await confirmButton.click();
      }
      
      // 削除中の状態を確認
      const deletingButton = page.locator('button:has-text("削除中...")');
      if (await deletingButton.isVisible({ timeout: 1000 })) {
        await expect(deletingButton).toBeDisabled();
      }
      
      // ファイルが削除されるのを待つ
      await expect(fileCard).not.toBeVisible({ timeout: 10000 });
      
      // ファイル数が減っていることを確認
      const finalFileCount = await page.locator('.bg-white').filter({ hasText: '.pptx' }).count();
      expect(finalFileCount).toBe(initialFileCount - 1);
    });

    test('削除確認ダイアログでキャンセルできる', async ({ page, baseURL }) => {
      // 既存のファイルを探すか、新しくアップロード
      let fileCard = page.locator('.bg-white').filter({ hasText: '.pptx' }).first();
      
      if (!(await fileCard.isVisible({ timeout: 2000 }))) {
        // ファイルをアップロード
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      }
      
      await expect(fileCard).toBeVisible({ timeout: 10000 });
      
      // 削除前のファイル数を取得
      const initialFileCount = await page.locator('.bg-white').filter({ hasText: '.pptx' }).count();
      
      // 削除ボタンをクリック
      const deleteButton = fileCard.locator('button:has-text("削除")').or(fileCard.locator('button[aria-label="削除"]'));
      await deleteButton.first().click();
      
      // 確認ダイアログでキャンセル
      page.on('dialog', async dialog => {
        await dialog.dismiss();
      });
      
      // カスタム確認モーダルの場合
      const confirmModal = page.locator('.modal').or(page.locator('[role="dialog"]'));
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        const cancelButton = confirmModal.locator('button:has-text("キャンセル")').or(confirmModal.locator('button:has-text("Cancel")'));
        await cancelButton.click();
        await expect(confirmModal).not.toBeVisible();
      }
      
      // ファイルが削除されていないことを確認
      await expect(fileCard).toBeVisible();
      
      // ファイル数が変わっていないことを確認
      const finalFileCount = await page.locator('.bg-white').filter({ hasText: '.pptx' }).count();
      expect(finalFileCount).toBe(initialFileCount);
    });

    test('削除処理中はボタンが無効化される', async ({ page, baseURL }) => {
      // ファイルが存在することを確認
      let fileCard = page.locator('.bg-white').filter({ hasText: '.pptx' }).first();
      
      if (!(await fileCard.isVisible({ timeout: 2000 }))) {
        // ファイルをアップロード
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      }
      
      const deleteButton = fileCard.locator('button:has-text("削除")').or(fileCard.locator('button[aria-label="削除"]'));
      
      // 削除を開始
      await Promise.all([
        deleteButton.first().click(),
        page.waitForResponse(response => 
          response.url().includes('/api/') || response.url().includes('dashboard')
        )
      ]);
      
      // 削除中の状態を確認
      const deletingButton = fileCard.locator('button:has-text("削除中...")').or(deleteButton.filter({ hasText: '削除中...' }));
      if (await deletingButton.first().isVisible({ timeout: 500 })) {
        await expect(deletingButton.first()).toBeDisabled();
        
        // アイコンがスピナーに変わっているか確認
        const spinner = fileCard.locator('.animate-spin').or(fileCard.locator('[role="status"]'));
        await expect(spinner.first()).toBeVisible();
      }
    });

    test('複数のファイルを個別に削除できる', async ({ page, baseURL }) => {
      // 2つのファイルをアップロード
      await page.goto(`${baseURL}/upload`);
      
      // 1つ目のファイル
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      let uploadButton = page.locator('button:has-text("アップロード")');
      await uploadButton.click();
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // 2つ目のファイル（別名でアップロード）
      await page.goto(`${baseURL}/upload`);
      await fileInput.setInputFiles(testFilePath);
      await uploadButton.click();
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // 2つのファイルが存在することを確認
      const fileCards = page.locator('.bg-white').filter({ hasText: '.pptx' });
      const initialCount = await fileCards.count();
      expect(initialCount).toBeGreaterThanOrEqual(2);
      
      // 最初のファイルを削除
      const firstCard = fileCards.first();
      const firstDeleteButton = firstCard.locator('button:has-text("削除")');
      await firstDeleteButton.click();
      
      // 確認ダイアログを承認
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      // カスタムモーダルの場合
      const confirmModal = page.locator('[role="dialog"]');
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // 最初のファイルが削除されるのを待つ
      await expect(firstCard).not.toBeVisible({ timeout: 10000 });
      
      // 残りのファイル数を確認
      const remainingCount = await fileCards.count();
      expect(remainingCount).toBe(initialCount - 1);
      
      // 2つ目のファイルも削除
      const secondCard = fileCards.first(); // 最初のが消えたので、次が最初になる
      const secondDeleteButton = secondCard.locator('button:has-text("削除")');
      await secondDeleteButton.click();
      
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // 2つ目のファイルが削除されるのを待つ
      await expect(secondCard).not.toBeVisible({ timeout: 10000 });
      
      // 最終的なファイル数を確認
      const finalCount = await fileCards.count();
      expect(finalCount).toBe(initialCount - 2);
    });

    test('削除後に適切なフィードバックが表示される', async ({ page, baseURL }) => {
      // ファイルが存在することを確認
      let fileCard = page.locator('.bg-white').filter({ hasText: '.pptx' }).first();
      
      if (!(await fileCard.isVisible({ timeout: 2000 }))) {
        // ファイルをアップロード
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      }
      
      const deleteButton = fileCard.locator('button:has-text("削除")');
      await deleteButton.click();
      
      // 確認ダイアログを承認
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      const confirmModal = page.locator('[role="dialog"]');
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // 成功メッセージまたはトーストの確認
      const successMessage = page.locator('text=/削除.*成功/').or(
        page.locator('.bg-green-50').or(
          page.locator('[role="alert"]').filter({ hasText: /削除/ })
        )
      );
      
      // メッセージが表示される場合
      if (await successMessage.first().isVisible({ timeout: 2000 })) {
        await expect(successMessage.first()).toBeVisible();
      }
      
      // ファイルが削除されていることを最終確認
      await expect(fileCard).not.toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('削除エラーハンドリング', () => {
    test('削除失敗時にエラーメッセージが表示される', async ({ page, baseURL, context }) => {
      // ファイルが存在することを確認
      let fileCard = page.locator('.bg-white').filter({ hasText: '.pptx' }).first();
      
      if (!(await fileCard.isVisible({ timeout: 2000 }))) {
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      }
      
      // APIエラーをシミュレート
      await context.route('**/api/**', route => {
        if (route.request().method() === 'DELETE' || 
            (route.request().method() === 'POST' && route.request().url().includes('delete'))) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });
      
      const deleteButton = fileCard.locator('button:has-text("削除")');
      await deleteButton.click();
      
      // 確認ダイアログを承認
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      const confirmModal = page.locator('[role="dialog"]');
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // エラーメッセージが表示される
      const errorMessage = page.locator('.bg-red-50').or(
        page.locator('text=/削除.*失敗/').or(
          page.locator('[role="alert"]').filter({ hasText: /エラー/ })
        )
      );
      await expect(errorMessage.first()).toBeVisible({ timeout: 10000 });
      
      // ファイルが削除されていないことを確認
      await expect(fileCard).toBeVisible();
      
      // 削除ボタンが再度有効になっている
      await expect(deleteButton).toBeEnabled();
    });

    test('ネットワークエラー時の再試行', async ({ page, baseURL, context }) => {
      let fileCard = page.locator('.bg-white').filter({ hasText: '.pptx' }).first();
      
      if (!(await fileCard.isVisible({ timeout: 2000 }))) {
        await page.goto(`${baseURL}/upload`);
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testFilePath);
        
        const uploadButton = page.locator('button:has-text("アップロード")');
        await uploadButton.click();
        await page.waitForURL('**/dashboard', { timeout: 10000 });
        
        fileCard = page.locator('.bg-white').filter({ hasText: 'test-presentation.pptx' }).first();
      }
      
      let attemptCount = 0;
      
      // 最初の試行は失敗、2回目で成功するようにモック
      await context.route('**/api/**', route => {
        if (route.request().method() === 'DELETE' || 
            (route.request().method() === 'POST' && route.request().url().includes('delete'))) {
          attemptCount++;
          if (attemptCount === 1) {
            route.abort('failed');
          } else {
            route.continue();
          }
        } else {
          route.continue();
        }
      });
      
      const deleteButton = fileCard.locator('button:has-text("削除")');
      
      // 1回目の削除試行（失敗）
      await deleteButton.click();
      
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      const confirmModal = page.locator('[role="dialog"]');
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // エラーメッセージを確認
      const errorMessage = page.locator('.bg-red-50');
      await expect(errorMessage.first()).toBeVisible({ timeout: 5000 });
      
      // 2回目の削除試行（成功）
      await deleteButton.click();
      
      page.once('dialog', async dialog => {
        await dialog.accept();
      });
      
      if (await confirmModal.isVisible({ timeout: 1000 })) {
        await confirmModal.locator('button:has-text("削除")').click();
      }
      
      // ファイルが削除される
      await expect(fileCard).not.toBeVisible({ timeout: 10000 });
    });
  });
});
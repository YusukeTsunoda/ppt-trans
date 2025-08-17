import { Page, expect } from '@playwright/test';

/**
 * E2Eテストヘルパー関数
 * テストの信頼性向上のための共通ユーティリティ
 */

/**
 * アップロード成功を確認する明示的なアサーション
 */
export async function assertUploadSuccess(page: Page, timeout = 15000) {
  // 成功条件のいずれかを待機
  const successPromises = [
    page.waitForSelector('text=/正常にアップロード|successfully/i', { timeout, state: 'visible' }).catch(() => null),
    page.waitForURL('**/dashboard', { timeout }).catch(() => null),
    page.waitForSelector('[data-testid="upload-success"]', { timeout, state: 'visible' }).catch(() => null)
  ];

  // いずれかの成功条件が満たされるまで待機
  const results = await Promise.race([
    Promise.all(successPromises),
    new Promise<null[]>((resolve) => {
      // 少なくとも1つの成功条件が満たされたら解決
      successPromises.forEach(promise => {
        promise.then(result => {
          if (result !== null) {
            resolve([result]);
          }
        });
      });
    })
  ]);

  // 最終的な状態をチェック
  const finalChecks = await Promise.all([
    page.locator('text=/正常にアップロード|successfully/i').count(),
    page.url().includes('dashboard'),
    page.locator('[data-testid="upload-success"]').count()
  ]);

  const isSuccess = finalChecks.some(indicator => 
    typeof indicator === 'boolean' ? indicator : indicator > 0
  );

  expect(isSuccess, 'アップロード成功の指標が見つかりません').toBeTruthy();
}

/**
 * ページ遷移を保証する
 */
export async function assertNavigationTo(page: Page, urlPattern: string | RegExp, timeout = 10000) {
  await expect(page).toHaveURL(urlPattern, { 
    timeout,
    message: `${urlPattern}への遷移が${timeout}ms以内に完了しませんでした`
  });
}

/**
 * 要素の可視性を保証する
 */
export async function assertElementVisible(
  page: Page, 
  selector: string, 
  message?: string,
  timeout = 5000
) {
  const element = page.locator(selector);
  await expect(element).toBeVisible({
    timeout,
    message: message || `要素 ${selector} が表示されていません`
  });
  return element;
}

/**
 * テストデータのクリーンアップ
 */
export async function cleanupTestData(page: Page, fileId?: string) {
  if (!fileId) return;
  
  try {
    // APIエンドポイントを使用して直接削除
    await page.request.delete(`/api/files/${fileId}`);
  } catch (error) {
    console.warn(`テストデータのクリーンアップに失敗: ${error}`);
  }
}

/**
 * ネットワーク待機の改善
 */
export async function waitForNetworkSettled(page: Page, timeout = 3000) {
  // ネットワークアイドル状態を待つ
  await page.waitForLoadState('networkidle', { timeout });
  
  // 追加で短い待機（レンダリング完了待ち）
  await page.waitForTimeout(500);
}

/**
 * エラーメッセージの存在を保証
 */
export async function assertErrorMessage(
  page: Page,
  errorPattern: string | RegExp,
  timeout = 5000
) {
  // data-testid="upload-error"を優先的に探す
  const errorContainer = page.locator('[data-testid="upload-error"]');
  if (await errorContainer.count() > 0) {
    await expect(errorContainer).toBeVisible({ timeout });
    const errorText = await errorContainer.textContent();
    if (typeof errorPattern === 'string') {
      expect(errorText).toContain(errorPattern);
    } else {
      expect(errorText).toMatch(errorPattern);
    }
  } else {
    // フォールバック：text セレクターを使用（first()で最初の1つに限定）
    const errorLocator = page.locator(`text=${errorPattern}`).first();
    await expect(errorLocator).toBeVisible({
      timeout,
      message: `エラーメッセージ "${errorPattern}" が表示されていません`
    });
  }
}

/**
 * フォーム入力のヘルパー
 */
export async function fillForm(
  page: Page,
  formData: Record<string, string>
) {
  for (const [field, value] of Object.entries(formData)) {
    const input = page.locator(`input[name="${field}"]`);
    await input.fill(value);
    
    // 入力値の検証
    await expect(input).toHaveValue(value);
  }
}

/**
 * ボタンの状態を確認してクリック
 */
export async function clickWhenEnabled(
  page: Page,
  buttonText: string,
  timeout = 5000
) {
  const button = page.locator(`button:has-text("${buttonText}")`);
  
  // ボタンが有効になるまで待機
  await expect(button).toBeEnabled({ timeout });
  
  // クリック
  await button.click();
  
  return button;
}

/**
 * テスト実行のリトライメカニズム
 */
export async function retryOnFailure<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
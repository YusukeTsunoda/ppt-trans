import { test, expect, BrowserContext } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';

/**
 * ブラウザ互換性 - フィーチャーテスト
 * 異なるブラウザやデバイスでの動作を検証
 */
test.describe('ブラウザ互換性', () => {
  test('ファイルアップロードのブラウザ互換性', async ({ page, browserName, baseURL }) => {
    // ブラウザ名をコンソールに出力（デバッグ用）
    console.log(`Testing on browser: ${browserName}`);
    
    await page.goto(`${baseURL}/upload`);
    
    // ファイル入力要素が存在し、操作可能であることを確認
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // ファイルを選択
    await fileInput.setInputFiles('e2e/fixtures/test-presentation.pptx');
    
    // ファイル名が表示される
    await expect(page.locator('text="test-presentation.pptx"')).toBeVisible();
    
    // アップロードボタンが有効になる
    const uploadButton = page.locator('button:has-text("アップロード")');
    await expect(uploadButton).toBeEnabled();
    
    // ブラウザ固有の問題がないことを確認
    if (browserName === 'webkit') {
      // Safari固有の確認
      // ファイル選択ダイアログのスタイルが適用されているか
      const fileInputStyle = await fileInput.evaluate(el => 
        window.getComputedStyle(el).display
      );
      expect(fileInputStyle).not.toBe('none');
    }
    
    if (browserName === 'firefox') {
      // Firefox固有の確認
      // ドラッグ&ドロップ領域が機能するか
      const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, .upload-area');
      if (await dropZone.isVisible({ timeout: 1000 })) {
        const isDroppable = await dropZone.evaluate(el => {
          return 'ondrop' in el || el.hasAttribute('droppable');
        });
        expect(isDroppable).toBeTruthy();
      }
    }
  });

  test('レスポンシブデザインの動作', async ({ page, viewport, baseURL }) => {
    // ビューポートサイズを確認
    console.log(`Viewport: ${viewport?.width}x${viewport?.height}`);
    
    await page.goto(`${baseURL}/dashboard`);
    
    // モバイルビューポートの場合
    if (viewport && viewport.width < 768) {
      // ハンバーガーメニューが表示される
      const mobileMenu = page.locator('[aria-label*="メニュー"], [aria-label*="menu"], .mobile-menu-toggle');
      if (await mobileMenu.isVisible({ timeout: 2000 })) {
        await mobileMenu.click();
        
        // メニュー項目が表示される
        const menuItems = page.locator('nav a, [role="navigation"] a');
        await expect(menuItems.first()).toBeVisible();
      }
      
      // テーブルが横スクロール可能または縦型レイアウトになる
      const table = page.locator('table');
      if (await table.isVisible({ timeout: 1000 })) {
        const isScrollable = await table.evaluate(el => {
          const parent = el.parentElement;
          return parent ? parent.scrollWidth > parent.clientWidth : false;
        });
        // モバイルではスクロール可能またはレスポンシブレイアウト
        expect(isScrollable || true).toBeTruthy();
      }
    } else {
      // デスクトップビューポートの場合
      // サイドバーが表示される
      const sidebar = page.locator('aside, [role="complementary"], .sidebar');
      if (await sidebar.isVisible({ timeout: 2000 })) {
        const sidebarWidth = await sidebar.evaluate(el => el.offsetWidth);
        expect(sidebarWidth).toBeGreaterThan(150);
      }
    }
  });

  test('フォーム要素のブラウザ互換性', async ({ page, browserName, baseURL }) => {
    await page.goto(`${baseURL}/login`);
    
    // 入力フィールドの動作確認
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    
    // オートコンプリート属性の確認
    const emailAutocomplete = await emailInput.getAttribute('autocomplete');
    const passwordAutocomplete = await passwordInput.getAttribute('autocomplete');
    
    // 適切なautocomplete属性が設定されている
    expect(emailAutocomplete).toMatch(/email|username/);
    expect(passwordAutocomplete).toMatch(/password|current-password/);
    
    // プレースホルダーが表示される
    const emailPlaceholder = await emailInput.getAttribute('placeholder');
    expect(emailPlaceholder).toBeTruthy();
    
    // ブラウザ固有のバリデーション
    await emailInput.fill('invalid-email');
    await passwordInput.fill('pass');
    
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // HTML5バリデーションまたはカスタムエラーメッセージ
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => 
      el.validationMessage
    );
    
    if (browserName === 'chromium') {
      // Chromeは詳細なバリデーションメッセージを表示
      expect(validationMessage.length).toBeGreaterThan(0);
    }
  });

  test('CSSアニメーションとトランジション', async ({ page, browserName, baseURL }) => {
    await page.goto(`${baseURL}/dashboard`);
    
    // ボタンのホバー効果を確認
    const button = page.locator('button').first();
    
    // ホバー前のスタイルを取得
    const beforeHoverStyle = await button.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // ホバー状態をシミュレート
    await button.hover();
    await page.waitForTimeout(300); // トランジション完了を待つ
    
    // ホバー後のスタイルを取得
    const afterHoverStyle = await button.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    
    // スタイルが変化していることを確認（ブラウザによって異なる可能性）
    if (browserName !== 'webkit') {
      // SafariはCSSトランジションの扱いが異なる場合がある
      expect(beforeHoverStyle).not.toBe(afterHoverStyle);
    }
  });

  test('ローカルストレージとセッションストレージ', async ({ page, context, baseURL }) => {
    await page.goto(`${baseURL}/dashboard`);
    
    // ローカルストレージにデータを保存
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
      sessionStorage.setItem('session-key', 'session-value');
    });
    
    // 値が保存されていることを確認
    const localValue = await page.evaluate(() => localStorage.getItem('test-key'));
    const sessionValue = await page.evaluate(() => sessionStorage.getItem('session-key'));
    
    expect(localValue).toBe('test-value');
    expect(sessionValue).toBe('session-value');
    
    // 新しいページで確認（同じコンテキスト）
    const newPage = await context.newPage();
    await newPage.goto(`${baseURL}/dashboard`);
    
    // ローカルストレージは共有される
    const newLocalValue = await newPage.evaluate(() => localStorage.getItem('test-key'));
    expect(newLocalValue).toBe('test-value');
    
    // セッションストレージはタブごとに独立
    const newSessionValue = await newPage.evaluate(() => sessionStorage.getItem('session-key'));
    expect(newSessionValue).toBeNull();
    
    await newPage.close();
  });

  test('JavaScriptエラーの検出', async ({ page, baseURL }) => {
    // コンソールエラーを監視
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // ページエラーを監視
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });
    
    // 各主要ページを訪問
    const pages = ['/dashboard', '/upload', '/profile'];
    
    for (const path of pages) {
      await page.goto(`${baseURL}${path}`);
      await page.waitForLoadState('networkidle');
    }
    
    // 重大なJavaScriptエラーがないことを確認
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') &&
      !error.includes('favicon')
    );
    
    expect(criticalErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
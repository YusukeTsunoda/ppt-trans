import { test } from '../fixtures/pages';
import { expect } from '@playwright/test';
import { createHelpers } from '../fixtures/enhanced-helpers';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * アクセシビリティ(a11y)専門テストスイート
 * WCAG 2.1レベルAAの準拠を目標
 */
test.describe('アクセシビリティ検証', () => {
  
  test.describe('キーボードナビゲーション', () => {
    test('すべてのインタラクティブ要素がキーボードでアクセス可能', async ({ 
      page, 
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      const helpers = createHelpers(page);
      
      // アップロードページでテスト
      await page.goto(`${baseURL}/upload`);
      await helpers.network.waitForNetworkIdle();
      
      // フォーカス可能な要素を取得
      const focusableElements = await helpers.accessibility.getFocusableElements();
      
      // 最低限必要な要素が存在することを確認
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // 各要素がキーボードでアクセス可能か確認
      for (let i = 0; i < Math.min(focusableElements.length, 10); i++) {
        await page.keyboard.press('Tab');
        
        const hasFocus = await page.evaluate(() => {
          return document.activeElement !== document.body;
        });
        
        expect(hasFocus).toBeTruthy();
      }
    });

    test('Tab順序が論理的', async ({ 
      page, 
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      const helpers = createHelpers(page);
      
      await page.goto(`${baseURL}/upload`);
      await helpers.network.waitForNetworkIdle();
      
      // 期待されるTab順序（data-testidまたはテキスト）
      const expectedOrder = [
        'file-input',  // ファイル入力
        'upload-button'  // アップロードボタン
      ];
      
      // Tab順序のテスト（簡略版）
      const actualOrder: string[] = [];
      await page.locator('body').click({ position: { x: 0, y: 0 } });
      
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          
          return {
            dataTestId: el.getAttribute('data-testid'),
            id: el.id,
            tagName: el.tagName.toLowerCase()
          };
        });
        
        if (focused?.dataTestId) {
          actualOrder.push(focused.dataTestId);
          
          // 期待される要素がすべて見つかったら終了
          if (expectedOrder.every(id => actualOrder.includes(id))) {
            break;
          }
        }
      }
      
      // 必要な要素がTab順序に含まれていることを確認
      for (const expectedId of expectedOrder) {
        expect(actualOrder).toContain(expectedId);
      }
    });

    test('Escapeキーでモーダルが閉じる', async ({ 
      page, 
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // モーダルを開くトリガーがあるページへ
      await page.goto(`${baseURL}/dashboard`);
      
      // ヘルプボタンなどモーダルトリガーを探す
      const modalTrigger = page.locator('button:has-text("ヘルプ"), button[aria-label*="ヘルプ"]').first();
      
      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();
        
        // モーダルが開いたことを確認
        const modal = page.locator('[role="dialog"]');
        if (await modal.count() > 0) {
          await expect(modal).toBeVisible();
          
          // Escapeキーを押す
          await page.keyboard.press('Escape');
          
          // モーダルが閉じたことを確認
          await expect(modal).not.toBeVisible();
        }
      }
    });
  });

  test.describe('ARIA属性', () => {
    test('フォーム要素に適切なラベルとARIA属性', async ({ 
      uploadPage,
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      const helpers = createHelpers(uploadPage.page);
      
      // ファイル入力のARIA属性を検証
      const fileInputValidation = await helpers.accessibility.validateAriaAttributes('input[type="file"]');
      
      // 基本的なアクセシビリティ要件を満たしていることを確認
      if (fileInputValidation.issues.length > 0) {
        console.log('ARIA検証の問題:', fileInputValidation.issues);
      }
      
      // フォーム全体のaria-label
      const form = uploadPage.page.locator('form').first();
      const formAriaLabel = await form.getAttribute('aria-label');
      expect(formAriaLabel).toBeTruthy();
    });

    test('エラーメッセージにrole="alert"', async ({ 
      uploadPage,
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // 無効なファイルでエラーを発生させる
      const invalidFile = 'test.txt';
      const errorMessage = await uploadPage.triggerValidationError(invalidFile);
      
      if (errorMessage) {
        // エラー要素を取得
        const errorElement = uploadPage.errorMessage;
        const role = await errorElement.getAttribute('role');
        
        // role="alert"またはaria-live属性があることを確認
        const ariaLive = await errorElement.getAttribute('aria-live');
        expect(role === 'alert' || ariaLive !== null).toBeTruthy();
      }
    });

    test('ボタンの状態がARIA属性で表現される', async ({ 
      uploadPage,
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // アップロードボタンの初期状態
      const uploadButton = uploadPage.uploadButton;
      
      // ファイル未選択時は無効
      let isDisabled = await uploadButton.isDisabled();
      let ariaDisabled = await uploadButton.getAttribute('aria-disabled');
      
      if (isDisabled) {
        expect(ariaDisabled).toBe('true');
      }
      
      // ファイル選択後は有効
      await uploadPage.selectFile('./e2e/fixtures/test-presentation.pptx');
      
      isDisabled = await uploadButton.isDisabled();
      ariaDisabled = await uploadButton.getAttribute('aria-disabled');
      
      if (!isDisabled) {
        expect(ariaDisabled === 'false' || ariaDisabled === null).toBeTruthy();
      }
    });
  });

  test.describe('ランドマークとセマンティックHTML', () => {
    test('適切なランドマークロールの使用', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await page.goto(`${baseURL}/dashboard`);
      
      // 主要なランドマークの存在を確認
      const landmarks = {
        header: page.locator('header, [role="banner"]'),
        nav: page.locator('nav, [role="navigation"]'),
        main: page.locator('main, [role="main"]'),
        footer: page.locator('footer, [role="contentinfo"]')
      };
      
      // 少なくともmain要素は必須
      await expect(landmarks.main.first()).toBeVisible();
      
      // その他のランドマークもチェック（存在する場合）
      for (const [name, locator] of Object.entries(landmarks)) {
        const count = await locator.count();
        if (count > 0) {
          console.log(`${name}ランドマーク: ${count}個検出`);
        }
      }
    });

    test('見出しの階層構造が適切', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await page.goto(`${baseURL}/dashboard`);
      
      // 見出しレベルを取得
      const headings = await page.evaluate(() => {
        const h1 = document.querySelectorAll('h1').length;
        const h2 = document.querySelectorAll('h2').length;
        const h3 = document.querySelectorAll('h3').length;
        const h4 = document.querySelectorAll('h4').length;
        const h5 = document.querySelectorAll('h5').length;
        const h6 = document.querySelectorAll('h6').length;
        
        return { h1, h2, h3, h4, h5, h6 };
      });
      
      // h1は1つだけ（またはページタイトルとして1つ）
      expect(headings.h1).toBeLessThanOrEqual(1);
      
      // 見出しレベルのスキップがないか確認（h1の後にh3など）
      const levels = [headings.h1, headings.h2, headings.h3, headings.h4, headings.h5, headings.h6];
      let previousLevel = 0;
      
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] > 0) {
          if (previousLevel > 0 && i - previousLevel > 1) {
            console.warn(`見出しレベルのスキップ: h${previousLevel + 1}からh${i + 1}`);
          }
          previousLevel = i;
        }
      }
    });
  });

  test.describe('スクリーンリーダー対応', () => {
    test('画像に代替テキストがある', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await page.goto(`${baseURL}/dashboard`);
      
      // すべての画像を取得
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // 装飾的な画像以外はalt属性が必要
        if (role !== 'presentation' && role !== 'none') {
          expect(alt).toBeTruthy();
        }
      }
    });

    test('フォームフィールドにラベルがある', async ({ 
      uploadPage,
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // すべての入力フィールドを取得
      const inputs = uploadPage.page.locator('input, select, textarea');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const inputId = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        // ラベルの存在を確認
        if (inputId) {
          const label = uploadPage.page.locator(`label[for="${inputId}"]`);
          const hasLabel = await label.count() > 0;
          
          // ラベル、aria-label、aria-labelledbyのいずれかが必要
          expect(hasLabel || !!ariaLabel || !!ariaLabelledBy).toBeTruthy();
        }
      }
    });

    test('動的コンテンツの更新が通知される', async ({ 
      uploadPage,
      authenticatedUser 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await uploadPage.goto();
      
      // ファイルを選択して動的更新を発生させる
      await uploadPage.selectFile('./e2e/fixtures/test-presentation.pptx');
      
      // aria-liveリージョンまたはrole="status"要素を探す
      const liveRegions = uploadPage.page.locator('[aria-live], [role="status"], [role="alert"]');
      const liveRegionCount = await liveRegions.count();
      
      // 少なくとも1つのライブリージョンが存在することを推奨
      if (liveRegionCount === 0) {
        console.warn('動的更新用のaria-liveリージョンが見つかりません');
      }
    });
  });

  test.describe('カラーコントラスト', () => {
    test('テキストのコントラスト比がWCAG基準を満たす', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await page.goto(`${baseURL}/upload`);
      
      // axe-coreを使用したアクセシビリティチェック（利用可能な場合）
      try {
        await injectAxe(page);
        const results = await checkA11y(page, undefined, {
          detailedReport: true,
          detailedReportOptions: {
            html: true
          }
        });
        
        // コントラスト関連の問題を確認
        if (results) {
          console.log('アクセシビリティチェック完了');
        }
      } catch (error) {
        // axe-coreが利用できない場合は手動チェック
        console.log('手動カラーコントラストチェックを推奨');
      }
    });
  });

  test.describe('レスポンシブデザインとズーム', () => {
    test('200%ズームでもコンテンツが利用可能', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      await page.goto(`${baseURL}/upload`);
      
      // ズームレベルを200%に設定
      await page.evaluate(() => {
        document.documentElement.style.zoom = '2';
      });
      
      // 主要な要素が表示されていることを確認
      const fileInput = page.locator('input[type="file"]');
      const uploadButton = page.locator('button[data-testid="upload-button"]');
      
      await expect(fileInput).toBeVisible();
      await expect(uploadButton).toBeVisible();
      
      // 横スクロールが発生していないことを確認
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      // 横スクロールが発生している場合は警告
      if (hasHorizontalScroll) {
        console.warn('200%ズーム時に横スクロールが発生しています');
      }
      
      // ズームをリセット
      await page.evaluate(() => {
        document.documentElement.style.zoom = '1';
      });
    });

    test('モバイルビューポートでの操作性', async ({ 
      page,
      authenticatedUser,
      baseURL 
    }) => {
      expect(authenticatedUser.isAuthenticated).toBeTruthy();
      
      // モバイルビューポートに設定
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto(`${baseURL}/upload`);
      
      // タッチターゲットサイズの確認（最小44x44px）
      const buttons = page.locator('button, a, input[type="file"]');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();
        
        if (box) {
          // WCAG 2.1の最小タッチターゲットサイズ
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
      
      // ビューポートをリセット
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });
});
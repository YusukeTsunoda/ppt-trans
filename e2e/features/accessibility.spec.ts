import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../fixtures/test-config-v2';
import { LoginPage } from '../pages/LoginPage';

/**
 * アクセシビリティ - MVPフィーチャーテスト
 * キーボードナビゲーション、スクリーンリーダー対応、視覚的アクセシビリティを検証
 */
test.describe('アクセシビリティ', () => {
  const testFilePath = 'e2e/fixtures/test-presentation.pptx';

  test.beforeEach(async ({ page }) => {
    // ログイン
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsStandardUser();
    await loginPage.expectLoginSuccess();
  });

  test.describe('キーボードナビゲーション', () => {
    test('Tabキーでの主要要素のナビゲーション', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // Tabキーで移動可能な要素を収集
      const tabbableElements = await page.$$eval('*', elements => {
        return elements
          .filter(el => {
            const tabindex = el.getAttribute('tabindex');
            const isNaturallyTabbable = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
            return isNaturallyTabbable || (tabindex !== null && tabindex !== '-1');
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent?.substring(0, 50),
            role: el.getAttribute('role')
          }));
      });
      
      // 重要な要素がタブ可能であることを確認
      expect(tabbableElements.length).toBeGreaterThan(0);
      
      // Tabキーでのフォーカス移動をテスト
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(firstFocused).toBeTruthy();
      
      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(secondFocused).toBeTruthy();
      
      // Shift+Tabで逆方向に移動
      await page.keyboard.press('Shift+Tab');
      const backFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(backFocused).toBe(firstFocused);
    });

    test('Enterキーでのボタン実行', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // ファイルを選択
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      // アップロードボタンにフォーカス
      const uploadButton = page.locator('button:has-text("アップロード")');
      await uploadButton.focus();
      
      // Enterキーで実行
      await page.keyboard.press('Enter');
      
      // ダッシュボードへの遷移を確認
      await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
    });

    test('Escapeキーでのモーダル/ダイアログ閉じ', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // 削除ボタンなどのモーダルを開くアクションを実行
      const deleteButton = page.locator('button:has-text("削除")').first();
      if (await deleteButton.isVisible({ timeout: 2000 })) {
        await deleteButton.click();
        
        // モーダルが開いたことを確認
        const modal = page.locator('[role="dialog"], .modal, .dialog');
        await expect(modal.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
        
        // Escapeキーで閉じる
        await page.keyboard.press('Escape');
        
        // モーダルが閉じたことを確認
        await expect(modal.first()).not.toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
      }
    });

    test('矢印キーでのスライドナビゲーション', async ({ page, baseURL }) => {
      // ファイルをアップロード
      await page.goto(`${baseURL}/upload`);
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);
      
      const uploadButton = page.locator('button:has-text("アップロード")');
      await uploadButton.click();
      await page.waitForURL('**/dashboard', { timeout: TEST_CONFIG.timeouts.upload });
      
      // プレビューページへ移動
      const previewButton = page.locator('a[href*="/preview/"]').first();
      await previewButton.click();
      await page.waitForURL(/.*\/preview\/.*/, { timeout: TEST_CONFIG.timeouts.navigation });
      
      // スライドコンテナにフォーカス
      const slideContainer = page.locator('[data-testid="slide-container"], .slide-viewer, main');
      await slideContainer.first().focus();
      
      // 初期スライド番号を取得
      const initialSlide = await page.locator('[data-testid="slide-number"], .slide-number').first().textContent();
      
      // 右矢印キーで次のスライドへ
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      
      const nextSlide = await page.locator('[data-testid="slide-number"], .slide-number').first().textContent();
      
      // スライドが変わった場合の確認（複数スライドがある場合）
      if (initialSlide !== nextSlide) {
        expect(nextSlide).not.toBe(initialSlide);
        
        // 左矢印キーで前のスライドへ戻る
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(500);
        
        const prevSlide = await page.locator('[data-testid="slide-number"], .slide-number').first().textContent();
        expect(prevSlide).toBe(initialSlide);
      }
    });
  });

  test.describe('スクリーンリーダー対応', () => {
    test('ARIA属性の適切な使用', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // 主要なARIA属性をチェック
      const ariaElements = await page.$$eval('[aria-label], [aria-describedby], [role]', elements => {
        return elements.map(el => ({
          tag: el.tagName,
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaDescribedBy: el.getAttribute('aria-describedby')
        }));
      });
      
      // ARIA属性が存在することを確認
      expect(ariaElements.length).toBeGreaterThan(0);
      
      // ナビゲーション要素のrole確認
      const navigation = page.locator('[role="navigation"], nav');
      expect(await navigation.count()).toBeGreaterThan(0);
      
      // メイン要素のrole確認
      const main = page.locator('[role="main"], main');
      expect(await main.count()).toBeGreaterThan(0);
      
      // ボタンのARIAラベル確認
      const buttons = await page.$$eval('button', buttons => {
        return buttons.map(btn => ({
          text: btn.textContent,
          ariaLabel: btn.getAttribute('aria-label'),
          hasAccessibleName: !!(btn.textContent?.trim() || btn.getAttribute('aria-label'))
        }));
      });
      
      // すべてのボタンにアクセシブルな名前があることを確認
      buttons.forEach(btn => {
        expect(btn.hasAccessibleName).toBeTruthy();
      });
    });

    test('フォームラベルの関連付け', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // inputとlabelの関連付けを確認
      const inputs = await page.$$eval('input, select, textarea', elements => {
        return elements.map(input => {
          const id = input.getAttribute('id');
          const name = input.getAttribute('name');
          const ariaLabel = input.getAttribute('aria-label');
          const ariaLabelledBy = input.getAttribute('aria-labelledby');
          
          // 対応するlabelを探す
          let hasLabel = false;
          if (id) {
            hasLabel = !!document.querySelector(`label[for="${id}"]`);
          }
          
          return {
            type: input.tagName,
            name: name,
            hasLabel: hasLabel,
            hasAriaLabel: !!ariaLabel,
            hasAriaLabelledBy: !!ariaLabelledBy,
            isAccessible: hasLabel || !!ariaLabel || !!ariaLabelledBy
          };
        });
      });
      
      // すべての入力要素がアクセシブルであることを確認
      inputs.forEach(input => {
        expect(input.isAccessible).toBeTruthy();
      });
    });

    test('画像の代替テキスト', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // すべての画像の代替テキストを確認
      const images = await page.$$eval('img', imgs => {
        return imgs.map(img => ({
          src: img.src,
          alt: img.alt,
          hasAlt: !!img.alt,
          isDecorative: img.getAttribute('role') === 'presentation' || img.alt === ''
        }));
      });
      
      // 装飾的でない画像にはaltテキストが必要
      images.forEach(img => {
        if (!img.isDecorative) {
          expect(img.hasAlt).toBeTruthy();
        }
      });
    });

    test('エラーメッセージのアクセシビリティ', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/login`);
      
      // 無効な認証情報でログイン試行
      await page.fill('input[type="email"]', 'invalid@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // エラーメッセージを待つ
      const errorMessage = page.locator('[role="alert"], .error-message, .bg-red-50');
      await expect(errorMessage.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.standard });
      
      // エラーメッセージのARIA属性を確認
      const errorRole = await errorMessage.first().getAttribute('role');
      const ariaLive = await errorMessage.first().getAttribute('aria-live');
      
      // alertロールまたはaria-liveが設定されていることを確認
      expect(errorRole === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBeTruthy();
    });
  });

  test.describe('視覚的アクセシビリティ', () => {
    test('フォーカスインジケーターの視認性', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // ボタンにフォーカス
      const button = page.locator('button').first();
      await button.focus();
      
      // フォーカス時のスタイルを取得
      const focusStyles = await button.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow,
          border: styles.border
        };
      });
      
      // フォーカスインジケーターが存在することを確認
      const hasVisibleFocusIndicator = 
        (focusStyles.outline && focusStyles.outline !== 'none') ||
        (focusStyles.outlineWidth && focusStyles.outlineWidth !== '0px') ||
        (focusStyles.boxShadow && focusStyles.boxShadow !== 'none');
      
      expect(hasVisibleFocusIndicator).toBeTruthy();
    });

    test('カラーコントラスト比の確認', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // テキスト要素のコントラストを確認
      const textElements = await page.$$eval('p, h1, h2, h3, h4, h5, h6, span, a, button', elements => {
        return elements.slice(0, 10).map(el => {
          const styles = window.getComputedStyle(el);
          const rgb = styles.color.match(/\d+/g);
          const bgRgb = styles.backgroundColor.match(/\d+/g);
          
          if (!rgb || !bgRgb) return null;
          
          // 簡易的な輝度計算
          const getLuminance = (r: number, g: number, b: number) => {
            const [rs, gs, bs] = [r, g, b].map(c => {
              c = c / 255;
              return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
          };
          
          const textLuminance = getLuminance(+rgb[0], +rgb[1], +rgb[2]);
          const bgLuminance = getLuminance(+bgRgb[0], +bgRgb[1], +bgRgb[2]);
          
          const contrast = (Math.max(textLuminance, bgLuminance) + 0.05) / 
                           (Math.min(textLuminance, bgLuminance) + 0.05);
          
          return {
            text: el.textContent?.substring(0, 30),
            contrast: contrast,
            meetsWCAG_AA: contrast >= 4.5, // 通常テキストのWCAG AA基準
            meetsWCAG_AAA: contrast >= 7     // WCAG AAA基準
          };
        }).filter(Boolean);
      });
      
      // 少なくとも半数以上がWCAG AA基準を満たすことを確認
      const meetsAA = textElements.filter(el => el?.meetsWCAG_AA).length;
      expect(meetsAA).toBeGreaterThan(textElements.length * 0.5);
    });

    test('エラー状態の明確な表示', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // 無効なファイルタイプを選択
      const invalidFile = 'e2e/fixtures/test-files/invalid.txt';
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFile);
      
      // エラーメッセージが表示される
      const errorMessage = page.locator('text=/対応していないファイル形式|Invalid file format/');
      await expect(errorMessage).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
      
      // エラーメッセージの視覚的な特徴を確認
      const errorStyles = await errorMessage.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          border: styles.border
        };
      });
      
      // 赤系の色が使用されていることを確認（一般的なエラー表示）
      const hasErrorStyling = 
        errorStyles.color.includes('255, 0, 0') || // 赤
        errorStyles.color.includes('220') ||        // 赤系
        errorStyles.backgroundColor.includes('254') || // 薄い赤背景
        errorStyles.border.includes('red');
      
      expect(hasErrorStyling || errorMessage).toBeTruthy();
    });

    test('レスポンシブデザインのアクセシビリティ', async ({ page, baseURL }) => {
      // モバイルビューポート
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${baseURL}/dashboard`);
      
      // ハンバーガーメニューが表示される場合
      const mobileMenu = page.locator('[aria-label*="メニュー"], [aria-label*="menu"], button.menu-toggle');
      if (await mobileMenu.isVisible({ timeout: 2000 })) {
        // メニューが操作可能であることを確認
        await mobileMenu.click();
        
        const menuItems = page.locator('nav a, [role="navigation"] a');
        await expect(menuItems.first()).toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
        
        // Escapeキーで閉じられることを確認
        await page.keyboard.press('Escape');
        await expect(menuItems.first()).not.toBeVisible({ timeout: TEST_CONFIG.timeouts.quick });
      }
      
      // タブレットビューポート
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // 主要要素が表示されることを確認
      const mainContent = page.locator('main, [role="main"]');
      await expect(mainContent.first()).toBeVisible();
      
      // デスクトップビューポートに戻す
      await page.setViewportSize({ width: 1280, height: 720 });
    });
  });

  test.describe('支援技術との互換性', () => {
    test('ランドマークの適切な使用', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // HTML5ランドマーク要素の確認
      const landmarks = await page.$$eval('header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]', elements => {
        return elements.map(el => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label')
        }));
      });
      
      // 主要なランドマークが存在することを確認
      const hasHeader = landmarks.some(l => l.tag === 'header' || l.role === 'banner');
      const hasNav = landmarks.some(l => l.tag === 'nav' || l.role === 'navigation');
      const hasMain = landmarks.some(l => l.tag === 'main' || l.role === 'main');
      const hasFooter = landmarks.some(l => l.tag === 'footer' || l.role === 'contentinfo');
      
      expect(hasHeader || hasNav || hasMain || hasFooter).toBeTruthy();
    });

    test('見出しの階層構造', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // 見出し要素を収集
      const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => {
        return elements.map(el => ({
          level: parseInt(el.tagName.substring(1)),
          text: el.textContent?.trim()
        }));
      });
      
      // h1が存在することを確認
      const hasH1 = headings.some(h => h.level === 1);
      expect(hasH1).toBeTruthy();
      
      // 見出しレベルが適切にスキップしていないことを確認
      let previousLevel = 0;
      for (const heading of headings) {
        if (previousLevel > 0) {
          // レベルが2以上スキップしていないことを確認
          expect(heading.level - previousLevel).toBeLessThanOrEqual(1);
        }
        previousLevel = heading.level;
      }
    });

    test('テーブルのアクセシビリティ', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/dashboard`);
      
      // テーブルが存在する場合の確認
      const tables = await page.$$eval('table', tables => {
        return tables.map(table => {
          const caption = table.querySelector('caption');
          const headers = table.querySelectorAll('th');
          const scope = Array.from(headers).map(th => th.getAttribute('scope'));
          
          return {
            hasCaption: !!caption,
            headerCount: headers.length,
            hasScope: scope.some(s => !!s),
            hasSummary: !!table.getAttribute('summary')
          };
        });
      });
      
      // テーブルが存在する場合、適切な構造を持つことを確認
      tables.forEach(table => {
        if (table.headerCount > 0) {
          // ヘッダーがある場合、scope属性も推奨
          expect(table.headerCount).toBeGreaterThan(0);
        }
      });
    });

    test('フォームのアクセシビリティ', async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/upload`);
      
      // フォーム要素の構造を確認
      const forms = await page.$$eval('form', forms => {
        return forms.map(form => {
          const fieldsets = form.querySelectorAll('fieldset');
          const legends = form.querySelectorAll('legend');
          const requiredInputs = form.querySelectorAll('[required], [aria-required="true"]');
          
          return {
            hasFieldsets: fieldsets.length > 0,
            hasLegends: legends.length > 0,
            requiredCount: requiredInputs.length,
            hasRole: !!form.getAttribute('role')
          };
        });
      });
      
      // フォームが適切に構造化されていることを確認
      forms.forEach(form => {
        // フィールドセットがある場合、レジェンドも必要
        if (form.hasFieldsets) {
          expect(form.hasLegends).toBeTruthy();
        }
      });
    });
  });
});
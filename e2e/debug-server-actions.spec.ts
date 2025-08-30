/**
 * Server Actions デバッグテスト
 * Server Actions の動作を段階的に確認
 */

import { test, expect } from '@playwright/test';
import { UNIFIED_TEST_CONFIG } from './config/unified-test-config';

test.describe('Server Actions Debug', () => {
  test('フォームのaction属性を確認', async ({ page }) => {
    await page.goto('/login');
    
    // フォーム要素を取得
    const form = page.locator('form').first();
    
    // action属性を確認
    const actionAttr = await form.getAttribute('action');
    console.log('Form action attribute:', actionAttr);
    
    // フォームのHTMLを出力
    const formHtml = await form.evaluate(el => el.outerHTML);
    console.log('Form HTML:', formHtml.substring(0, 200));
    
    // Server Actionsが正しく設定されているか確認
    expect(actionAttr).not.toContain('javascript:throw');
    expect(actionAttr).toBeTruthy();
  });

  test('開発サーバーでの基本的なログイン', async ({ page }) => {
    await page.goto('/login');
    
    // デバッグ: ネットワークリクエストを監視
    page.on('request', request => {
      if (request.method() === 'POST') {
        console.log('POST request:', request.url());
        console.log('Headers:', request.headers());
      }
    });
    
    page.on('response', response => {
      if (response.request().method() === 'POST') {
        console.log('POST response:', response.status(), response.url());
      }
    });
    
    // フォーム入力
    await page.fill('[name="email"]', UNIFIED_TEST_CONFIG.users.standard.email);
    await page.fill('[name="password"]', UNIFIED_TEST_CONFIG.users.standard.password);
    
    // 送信前の状態を記録
    const submitButton = page.locator('button[type="submit"]');
    const initialText = await submitButton.textContent();
    console.log('Initial button text:', initialText);
    
    // フォーム送信を試行
    const navigationPromise = page.waitForURL(/\/(dashboard|login)/, { 
      timeout: 5000,
      waitUntil: 'domcontentloaded'
    }).catch(e => {
      console.log('Navigation timeout or error:', e.message);
      return null;
    });
    
    await submitButton.click();
    
    // ボタンの状態変化を確認
    await page.waitForTimeout(100);
    const pendingText = await submitButton.textContent();
    console.log('Button text after click:', pendingText);
    
    // disabled状態を確認
    const isDisabled = await submitButton.isDisabled();
    console.log('Button disabled:', isDisabled);
    
    // ナビゲーション結果を待つ
    await navigationPromise;
    
    // 最終的なURLを確認
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    
    // エラーメッセージの有無を確認
    const errorElements = await page.locator('.bg-red-50, [role="alert"]').all();
    if (errorElements.length > 0) {
      for (const el of errorElements) {
        const text = await el.textContent();
        console.log('Error found:', text);
      }
    }
  });

  test('直接的なServer Action呼び出し確認', async ({ page }) => {
    // Server Actionを直接テストするために、簡単なテストページを作成
    await page.goto('/login');
    
    // JavaScriptでServer Actionを直接呼び出してみる
    const result = await page.evaluate(async () => {
      // FormDataを作成
      const formData = new FormData();
      formData.append('email', UNIFIED_TEST_CONFIG.users.standard.email);
      formData.append('password', UNIFIED_TEST_CONFIG.users.standard.password);
      
      try {
        // フォーム要素を取得
        const form = document.querySelector('form');
        if (!form) return { error: 'Form not found' };
        
        // フォームのaction関数を取得してみる
        const actionProp = (form as any).action;
        console.log('Form action property type:', typeof actionProp);
        
        // React Propsを確認
        const reactPropsKey = Object.keys(form).find(key => key.startsWith('__react'));
        if (reactPropsKey) {
          const reactProps = (form as any)[reactPropsKey];
          console.log('React props found:', reactProps);
        }
        
        return { 
          actionType: typeof actionProp,
          hasReactProps: !!reactPropsKey
        };
      } catch (error) {
        return { error: String(error) };
      }
    });
    
    console.log('Direct action call result:', result);
  });

  test('Next.js Server Actions環境確認', async ({ page }) => {
    await page.goto('/');
    
    // Next.jsのバージョンとServer Actions設定を確認
    const nextData = await page.evaluate(() => {
      const nextDataScript = document.getElementById('__NEXT_DATA__');
      if (!nextDataScript) return null;
      
      try {
        const data = JSON.parse(nextDataScript.textContent || '{}');
        return {
          buildId: data.buildId,
          runtimeConfig: data.runtimeConfig,
          nextExport: data.nextExport
        };
      } catch {
        return null;
      }
    });
    
    console.log('Next.js data:', nextData);
    
    // Server Actionsが有効かどうか確認
    const hasServerActions = await page.evaluate(() => {
      // window.__nextまたは関連するグローバル変数を確認
      return {
        hasNextRouter: typeof (window as any).__NEXT_ROUTER_STATE !== 'undefined',
        hasNextData: !!(window as any).__NEXT_DATA__
      };
    });
    
    console.log('Next.js features:', hasServerActions);
  });
});
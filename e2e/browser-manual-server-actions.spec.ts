/**
 * ブラウザでの手動確認テスト
 * Server Actionsの実際の動作を確認
 */

import { test, expect } from '@playwright/test';

test.describe('Browser Manual Test', () => {
  test('ブラウザでServer Actionsの動作を確認', async ({ page }) => {
    // ログインページを開く
    await page.goto('/login');
    
    // ページの準備を待つ
    await page.waitForLoadState('networkidle');
    
    // フォームが存在することを確認
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    
    // コンソールログを監視
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });
    
    // ネットワークエラーを監視
    page.on('pageerror', error => {
      console.log('Browser error:', error.message);
    });
    
    // React DevToolsの状態を確認
    const reactInfo = await page.evaluate(() => {
      // React Fiber情報を取得
      const root = document.querySelector('#__next') || document.querySelector('[id^="__next"]');
      if (!root) return { hasRoot: false };
      
      // React内部プロパティを探す
      const keys = Object.keys(root);
      const reactKeys = keys.filter(key => key.startsWith('__react'));
      
      // フォーム要素のReact情報も確認
      const form = document.querySelector('form');
      const formKeys = form ? Object.keys(form).filter(key => key.startsWith('__react')) : [];
      
      return {
        hasRoot: true,
        rootReactKeys: reactKeys,
        formReactKeys: formKeys,
        formAction: form ? (form as HTMLFormElement).action : null
      };
    });
    
    console.log('React info:', reactInfo);
    
    // 実際のフォーム送信をテスト
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword123');
    
    // フォーム送信前のaction属性を確認
    const actionBefore = await form.getAttribute('action');
    console.log('Form action before submit:', actionBefore);
    
    // デベロッパーツールでネットワークタブを模擬
    const responsePromise = page.waitForResponse(response => {
      console.log('Response:', response.url(), response.status());
      return response.request().method() === 'POST';
    }, { timeout: 5000 }).catch(() => null);
    
    // フォーム送信
    await page.locator('button[type="submit"]').click();
    
    // レスポンスを待つ
    const response = await responsePromise;
    if (response) {
      console.log('POST response received:', response.url());
      const headers = response.headers();
      console.log('Response headers:', headers);
    } else {
      console.log('No POST response detected');
    }
    
    // 送信後の状態を確認
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('Current URL after submit:', currentUrl);
    
    // エラーメッセージまたは成功メッセージを確認
    const messages = await page.locator('.bg-red-50, .bg-green-50, [role="alert"]').all();
    for (const msg of messages) {
      const text = await msg.textContent();
      console.log('Message found:', text);
    }
    
    // 開発者向けデバッグ: 一時停止して手動確認可能にする
    if (process.env.PAUSE_TEST === 'true') {
      console.log('Test paused. Inspect the browser manually. Press Ctrl+C to continue...');
      await page.waitForTimeout(60000); // 60秒待機
    }
  });
  
  test('Server Component vs Client Component確認', async ({ page }) => {
    await page.goto('/login');
    
    // ページのHTMLソースを取得
    const htmlSource = await page.content();
    
    // Server Componentのマーカーを探す
    const hasServerMarkers = htmlSource.includes('use server') || 
                            htmlSource.includes('__NEXT_ACTION_ID');
    
    console.log('Has server markers:', hasServerMarkers);
    
    // Client Componentのマーカーを探す
    const hasClientMarkers = htmlSource.includes('use client');
    console.log('Has client markers:', hasClientMarkers);
    
    // フォームのHTMLを詳細に確認
    const formHtml = await page.locator('form').first().evaluate(el => {
      return {
        outerHTML: el.outerHTML.substring(0, 500),
        action: (el as HTMLFormElement).action,
        method: (el as HTMLFormElement).method,
        attributes: Array.from(el.attributes).map(attr => ({
          name: attr.name,
          value: attr.value.substring(0, 100)
        }))
      };
    });
    
    console.log('Form details:', JSON.stringify(formHtml, null, 2));
  });
});
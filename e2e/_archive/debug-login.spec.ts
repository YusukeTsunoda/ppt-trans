import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('ログイン後のURL遷移デバッグ', async ({ page, baseURL }) => {
  console.log('🔍 デバッグ開始: ログインフロー');
  
  // ログインページへ
  await page.goto(`${baseURL}/login`);
  console.log('📍 初期URL:', page.url());
  
  // リクエストとレスポンスを監視
  page.on('request', request => {
    if (request.url().includes('/api') || request.method() === 'POST') {
      console.log('➡️ Request:', request.method(), request.url());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api') || response.status() >= 300) {
      console.log('⬅️ Response:', response.status(), response.url());
      // リダイレクトヘッダーを確認
      const location = response.headers()['location'];
      if (location) {
        console.log('🔀 Redirect to:', location);
      }
    }
  });
  
  // ログインフォーム入力
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'testpassword123');
  
  // 送信前のURL
  console.log('📍 送信前URL:', page.url());
  
  // フォーム送信
  const submitButton = page.locator('button[type="submit"]:has-text("ログイン")');
  await submitButton.click();
  
  // URL変更を監視（最大15秒待機）
  let urlChanged = false;
  const startUrl = page.url();
  
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    console.log(`📍 ${i * 0.5}秒後: ${currentUrl}`);
    
    if (currentUrl !== startUrl && !currentUrl.includes('/login')) {
      urlChanged = true;
      console.log('✅ URL変更検出:', currentUrl);
      break;
    }
    
    // ページコンテンツも確認
    const isLoggedIn = await page.locator('text=/ようこそ|Welcome|Dashboard/').isVisible().catch(() => false);
    if (isLoggedIn) {
      console.log('✅ ログイン成功を示すコンテンツ検出');
      break;
    }
  }
  
  // 最終状態
  console.log('📍 最終URL:', page.url());
  console.log('🎯 URLが変更された:', urlChanged);
  
  // ページの内容を確認
  const pageTitle = await page.title();
  console.log('📄 ページタイトル:', pageTitle);
  
  const bodyText = await page.locator('body').innerText();
  console.log('📄 ページ内容（最初の200文字）:', bodyText.substring(0, 200));
  
  // テスト結果
  expect(urlChanged || page.url().includes('dashboard')).toBeTruthy();
});
import { Page } from '@playwright/test';

/**
 * waitForTimeoutを排除した待機戦略
 * page.waitForFunctionとUIの状態変化を活用
 */

/**
 * Server Actionの完了を待つ
 * UIの状態変化を監視することで非同期処理の完了を検出
 */
export async function waitForServerAction(
  page: Page,
  options: {
    // 監視する要素のセレクター
    successIndicator?: string;
    errorIndicator?: string;
    loadingIndicator?: string;
    // 期待される状態変化
    expectedUrl?: string | RegExp;
    expectedText?: string;
    // タイムアウト
    timeout?: number;
  } = {}
) {
  const {
    successIndicator,
    errorIndicator,
    loadingIndicator,
    expectedUrl,
    expectedText,
    timeout = 10000
  } = options;

  // 複数の条件を並行して待機
  const promises: Promise<any>[] = [];

  // URLの変化を待つ
  if (expectedUrl) {
    promises.push(
      page.waitForURL(expectedUrl, { timeout }).catch(() => null)
    );
  }

  // 成功インジケーターを待つ
  if (successIndicator) {
    promises.push(
      page.waitForSelector(successIndicator, { state: 'visible', timeout }).catch(() => null)
    );
  }

  // エラーインジケーターを監視
  if (errorIndicator) {
    promises.push(
      page.waitForSelector(errorIndicator, { state: 'visible', timeout })
        .then(() => { throw new Error('エラーが表示されました'); })
        .catch(e => e.message === 'エラーが表示されました' ? Promise.reject(e) : null)
    );
  }

  // ローディングインジケーターの消失を待つ
  if (loadingIndicator) {
    promises.push(
      page.waitForSelector(loadingIndicator, { state: 'hidden', timeout }).catch(() => null)
    );
  }

  // テキストの出現を待つ
  if (expectedText) {
    promises.push(
      page.waitForFunction(
        (text) => document.body.textContent?.includes(text),
        expectedText,
        { timeout }
      ).catch(() => null)
    );
  }

  // いずれかの条件が満たされるまで待機
  const results = await Promise.race([
    Promise.all(promises),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Server Action タイムアウト')), timeout)
    )
  ]);

  return results;
}

/**
 * ネットワークが完全に静止するまで待つ
 * waitForLoadState('networkidle')の改善版
 */
export async function waitForNetworkIdle(
  page: Page,
  options: {
    timeout?: number;
    idleTime?: number;
  } = {}
) {
  const { timeout = 10000, idleTime = 500 } = options;

  // ネットワークリクエストを追跡
  let pendingRequests = 0;
  let lastActivityTime = Date.now();

  const requestHandler = () => {
    pendingRequests++;
    lastActivityTime = Date.now();
  };

  const responseHandler = () => {
    pendingRequests--;
    lastActivityTime = Date.now();
  };

  page.on('request', requestHandler);
  page.on('response', responseHandler);
  page.on('requestfailed', responseHandler);

  try {
    // ネットワークが静止するまで待つ
    await page.waitForFunction(
      ({ idleTime, pendingRequests, lastActivityTime }) => {
        const now = Date.now();
        return pendingRequests === 0 && (now - lastActivityTime) > idleTime;
      },
      { idleTime, pendingRequests, lastActivityTime },
      { timeout, polling: 100 }
    );
  } finally {
    page.off('request', requestHandler);
    page.off('response', responseHandler);
    page.off('requestfailed', responseHandler);
  }
}

/**
 * DOMの変更が完了するまで待つ
 */
export async function waitForDomSettled(
  page: Page,
  options: {
    selector?: string;
    timeout?: number;
    settleTime?: number;
  } = {}
) {
  const { selector = 'body', timeout = 5000, settleTime = 100 } = options;

  await page.waitForFunction(
    ({ selector, settleTime }) => {
      return new Promise<boolean>((resolve) => {
        const targetNode = document.querySelector(selector);
        if (!targetNode) {
          resolve(false);
          return;
        }

        let timeoutId: NodeJS.Timeout;
        const observer = new MutationObserver(() => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, settleTime);
        });

        observer.observe(targetNode, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true
        });

        // 初期タイマーを設定
        timeoutId = setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, settleTime);
      });
    },
    { selector, settleTime },
    { timeout }
  );
}

/**
 * フォーム送信の完了を待つ
 */
export async function waitForFormSubmission(
  page: Page,
  formSelector: string,
  options: {
    successUrl?: string | RegExp;
    successMessage?: string;
    errorMessage?: string;
    timeout?: number;
  } = {}
) {
  const {
    successUrl,
    successMessage,
    errorMessage,
    timeout = 15000
  } = options;

  // フォームが存在することを確認
  await page.waitForSelector(formSelector, { state: 'visible' });

  // 送信ボタンを探す
  const submitButton = page.locator(`${formSelector} button[type="submit"]`);
  
  // ボタンが無効化される（処理中）を待つ
  const processingPromise = submitButton.evaluateHandle((button) => {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.attributeName === 'disabled' || 
              mutation.attributeName === 'aria-busy') {
            observer.disconnect();
            resolve(true);
          }
        }
      });
      observer.observe(button, { attributes: true });
    });
  });

  // 成功条件を待つ
  const successPromises: Promise<any>[] = [];
  
  if (successUrl) {
    successPromises.push(page.waitForURL(successUrl, { timeout }));
  }
  
  if (successMessage) {
    successPromises.push(
      page.waitForFunction(
        (msg) => document.body.textContent?.includes(msg),
        successMessage,
        { timeout }
      )
    );
  }

  // エラー条件を監視
  let errorPromise: Promise<void> | null = null;
  if (errorMessage) {
    errorPromise = page.waitForFunction(
      (msg) => document.body.textContent?.includes(msg),
      errorMessage,
      { timeout: 3000 }
    ).then(() => {
      throw new Error(`フォーム送信エラー: ${errorMessage}`);
    }).catch(e => {
      if (e.message.includes('フォーム送信エラー')) throw e;
      return null;
    }) as Promise<void>;
  }

  // すべての条件を待つ
  try {
    await Promise.race([
      Promise.all(successPromises),
      errorPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('フォーム送信タイムアウト')), timeout)
      )
    ]);
  } finally {
    // クリーンアップ
    await processingPromise.catch(() => {});
  }
}

/**
 * アニメーションの完了を待つ
 */
export async function waitForAnimation(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
  } = {}
) {
  const { timeout = 5000 } = options;

  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      
      const animations = element.getAnimations();
      return animations.every(animation => animation.playState === 'finished');
    },
    selector,
    { timeout, polling: 'raf' } // requestAnimationFrameでポーリング
  );
}

/**
 * 要素の状態が安定するまで待つ
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  options: {
    checkInterval?: number;
    stableCount?: number;
    timeout?: number;
  } = {}
) {
  const { 
    checkInterval = 100, 
    stableCount = 3, 
    timeout = 5000 
  } = options;

  await page.waitForFunction(
    ({ selector, checkInterval, stableCount }) => {
      return new Promise<boolean>((resolve) => {
        const element = document.querySelector(selector);
        if (!element) {
          resolve(false);
          return;
        }

        let previousRect = element.getBoundingClientRect();
        let stableChecks = 0;

        const intervalId = setInterval(() => {
          const currentRect = element.getBoundingClientRect();
          
          if (
            previousRect.x === currentRect.x &&
            previousRect.y === currentRect.y &&
            previousRect.width === currentRect.width &&
            previousRect.height === currentRect.height
          ) {
            stableChecks++;
            if (stableChecks >= stableCount) {
              clearInterval(intervalId);
              resolve(true);
            }
          } else {
            stableChecks = 0;
            previousRect = currentRect;
          }
        }, checkInterval);
      });
    },
    { selector, checkInterval, stableCount },
    { timeout }
  );
}
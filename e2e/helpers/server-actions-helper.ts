/**
 * Server Actions Helper for E2E Tests
 * Provides utilities to properly test Server Actions in Playwright
 */

import { Page } from '@playwright/test';

export class ServerActionsHelper {
  /**
   * Wait for Server Action to complete by monitoring network activity
   */
  static async waitForServerAction(page: Page, actionName?: string) {
    // Server Actions typically make POST requests to the same URL
    const responsePromise = page.waitForResponse((response) => {
      const url = response.url();
      const method = response.request().method();
      
      // Server Actions use POST to the same page URL
      return method === 'POST' && (
        url.includes('/login') ||
        url.includes('/register') ||
        url.includes('/dashboard') ||
        url.includes('/upload') ||
        (actionName && url.includes(actionName))
      );
    }, { timeout: 10000 });

    return responsePromise;
  }

  /**
   * Submit form with Server Action and wait for completion
   */
  static async submitServerActionForm(
    page: Page,
    submitButtonSelector: string = 'button[type="submit"]',
    expectedUrl?: string | RegExp
  ) {
    // Set up response monitoring before clicking
    const navigationPromise = expectedUrl 
      ? page.waitForURL(expectedUrl, { 
          timeout: 10000,
          waitUntil: 'networkidle' 
        })
      : Promise.resolve();

    // Click submit and wait for Server Action response
    const [response] = await Promise.all([
      this.waitForServerAction(page),
      page.click(submitButtonSelector),
      navigationPromise
    ].filter(Boolean));

    // Wait a bit for any client-side effects
    await page.waitForTimeout(500);

    return response;
  }

  /**
   * Fill and submit a Server Action form
   */
  static async fillAndSubmitForm(
    page: Page,
    formData: Record<string, string>,
    submitButtonSelector: string = 'button[type="submit"]',
    expectedUrl?: string | RegExp
  ) {
    // Fill in form fields
    for (const [name, value] of Object.entries(formData)) {
      const selector = `[name="${name}"]`;
      await page.fill(selector, value);
    }

    // Submit form
    return this.submitServerActionForm(page, submitButtonSelector, expectedUrl);
  }

  /**
   * Check if Server Action error is displayed
   */
  static async hasServerActionError(page: Page): Promise<boolean> {
    // Common error display patterns for Server Actions
    const errorSelectors = [
      '[role="alert"]',
      '.bg-red-50',
      '.text-red-800',
      '[data-error]',
      '.error-message'
    ];

    for (const selector of errorSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get Server Action error message
   */
  static async getServerActionError(page: Page): Promise<string | null> {
    const errorSelectors = [
      '[role="alert"]',
      '.bg-red-50 p',
      '.text-red-800',
      '[data-error]',
      '.error-message'
    ];

    for (const selector of errorSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
        return await element.textContent();
      }
    }

    return null;
  }

  /**
   * Wait for Server Action pending state to complete
   */
  static async waitForPendingState(page: Page) {
    // Wait for any pending indicators to disappear
    await page.waitForFunction(() => {
      // Check for disabled submit buttons (pending state)
      const submitButtons = document.querySelectorAll('button[type="submit"]');
      for (const button of submitButtons) {
        if (button.hasAttribute('disabled')) {
          return false;
        }
      }
      
      // Check for pending text
      const pendingTexts = ['送信中', 'ログイン中', '処理中', 'アップロード中'];
      for (const text of pendingTexts) {
        if (document.body.textContent?.includes(text)) {
          return false;
        }
      }
      
      return true;
    }, { timeout: 10000 });
  }

  /**
   * Handle Server Action authentication flow
   */
  static async authenticateWithServerAction(
    page: Page,
    email: string,
    password: string
  ): Promise<boolean> {
    try {
      // Navigate to login page
      await page.goto('/login');
      
      // Fill and submit form
      await this.fillAndSubmitForm(
        page,
        { email, password },
        'button[type="submit"]',
        /.*\/dashboard/
      );

      // Verify we're on dashboard
      return page.url().includes('/dashboard');
    } catch (error) {
      console.error('Server Action authentication failed:', error);
      return false;
    }
  }
}
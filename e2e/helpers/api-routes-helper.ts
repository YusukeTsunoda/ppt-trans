/**
 * API Routes Helper for E2E Tests
 * Provides utilities to test API Routes in Playwright
 */

import { Page, Cookie } from '@playwright/test';

export class APIRoutesHelper {
  /**
   * Setup CSRF token for the page
   */
  private static async setupCSRFToken(page: Page): Promise<string> {
    // Fetch CSRF token from API
    const response = await page.request.get('/api/auth/csrf');
    const data = await response.json();
    
    const token = data.csrfToken || data.token;
    if (!token) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    // Set cookie with CSRF token
    await page.context().addCookies([{
      name: 'csrf-token',
      value: token,
      domain: new URL(page.url()).hostname,
      path: '/',
      httpOnly: false,
      secure: false, // false for test environment
      sameSite: 'Strict' as const
    }]);
    
    // Also store in localStorage and meta tag
    await page.evaluate((token) => {
      localStorage.setItem('csrf-token', token);
      // Add to meta tag
      let meta = document.querySelector('meta[name="csrf-token"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'csrf-token');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', token);
    }, token);
    
    return token;
  }

  /**
   * Wait for API Route to complete by monitoring network activity
   */
  static async waitForAPIRoute(page: Page, routePath: string) {
    // API Routes make requests to /api/* endpoints
    const responsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return url.includes(`/api/${routePath}`);
    }, { timeout: 10000 });

    return responsePromise;
  }

  /**
   * Submit form to API Route and wait for completion
   */
  static async submitFormToAPI(
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

    // Click submit
    await page.click(submitButtonSelector);
    
    // Wait for navigation if expected
    if (expectedUrl) {
      await navigationPromise;
    }

    return true;
  }

  /**
   * Fill form and submit to API Route with CSRF protection
   */
  static async fillAndSubmitForm(
    page: Page,
    formData: Record<string, string>,
    submitButtonSelector: string = 'button[type="submit"]',
    expectedUrl?: string | RegExp
  ) {
    // Setup CSRF token first
    const csrfToken = await this.setupCSRFToken(page);
    
    // Add interceptor to include CSRF token in headers
    await page.route('**/api/**', async (route, request) => {
      const headers = {
        ...request.headers(),
        'X-CSRF-Token': csrfToken,
      };
      await route.continue({ headers });
    });
    
    // Fill in all form fields
    for (const [field, value] of Object.entries(formData)) {
      // Try different selector strategies
      try {
        // First try by name attribute
        const nameLocator = page.locator(`input[name="${field}"]`);
        if (await nameLocator.count() > 0) {
          await nameLocator.fill(value);
          continue;
        }
        
        // Then try by id attribute
        const idLocator = page.locator(`input[id="${field}"]`);
        if (await idLocator.count() > 0) {
          await idLocator.fill(value);
          continue;
        }
        
        // Try by type attribute for special cases
        if (field === 'email') {
          const emailLocator = page.locator('input[type="email"]');
          if (await emailLocator.count() > 0) {
            await emailLocator.fill(value);
            continue;
          }
        }
        
        if (field === 'password') {
          const passwordLocator = page.locator('input[type="password"]');
          if (await passwordLocator.count() > 0) {
            await passwordLocator.fill(value);
            continue;
          }
        }
        
        console.warn(`Could not find field: ${field}`);
      } catch (error) {
        console.error(`Error filling field ${field}:`, error);
      }
    }

    // Submit form
    const result = await this.submitFormToAPI(page, submitButtonSelector, expectedUrl);
    
    // Clear route handler
    await page.unroute('**/api/**');
    
    return result;
  }

  /**
   * Test login with API Route
   */
  static async login(
    page: Page,
    email: string,
    password: string
  ) {
    await page.goto('/login');
    
    // Fill login form
    await page.fill('input[name="email"], input[type="email"]', email);
    await page.fill('input[name="password"], input[type="password"]', password);
    
    // Submit and wait for API response
    const responsePromise = this.waitForAPIRoute(page, 'auth/login');
    await page.click('button[type="submit"]');
    const response = await responsePromise;
    
    // Check if login was successful
    if (response.ok()) {
      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
    }
    
    return response;
  }

  /**
   * Test file upload with API Route
   */
  static async uploadFile(
    page: Page,
    filePath: string
  ) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    
    // Trigger file chooser
    await page.click('input[type="file"], [data-testid="upload-trigger"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    // Wait for upload to complete
    const response = await this.waitForAPIRoute(page, 'upload');
    return response;
  }

  /**
   * Make direct API request with CSRF protection
   */
  static async makeAPIRequest(
    page: Page,
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      headers?: Record<string, string>;
    } = {}
  ) {
    // Setup CSRF token
    const csrfToken = await this.setupCSRFToken(page);
    
    const response = await page.evaluate(async ({endpoint, options, csrfToken}) => {
      const res = await fetch(`/api/${endpoint}`, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
          ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'include'
      });
      
      return {
        ok: res.ok,
        status: res.status,
        data: await res.json().catch(() => null)
      };
    }, {endpoint, options, csrfToken});
    
    return response;
  }
}
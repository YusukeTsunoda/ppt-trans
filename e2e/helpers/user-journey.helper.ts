/**
 * User Journey Helper
 * 
 * Purpose: Provide high-level, user-centric methods for common workflows
 * Focus on what users want to achieve, not implementation details
 */

import { Page } from '@playwright/test';
import { LoginPage } from '../page-objects/login.page';
import { DashboardPage } from '../page-objects/dashboard.page';
import { UploadPage } from '../page-objects/upload.page';
import { TestDataFactory, TestUser, TestFile } from '../fixtures/test-data-factory';

export class UserJourneyHelper {
  constructor(private page: Page) {}

  /**
   * Complete user registration and login flow
   * @returns The created test user
   */
  async registerAndLogin(): Promise<TestUser> {
    const testUser = TestDataFactory.createUser();
    
    // Navigate to registration page
    await this.page.goto('/register');
    
    // Fill registration form with data-testid selectors
    await this.page.getByTestId('register-email').fill(testUser.email);
    await this.page.getByTestId('register-password').fill(testUser.password);
    await this.page.getByTestId('register-confirm-password').fill(testUser.password);
    
    if (testUser.firstName) {
      const firstNameField = this.page.getByTestId('register-firstname');
      if (await firstNameField.isVisible()) {
        await firstNameField.fill(testUser.firstName);
      }
    }
    
    if (testUser.lastName) {
      const lastNameField = this.page.getByTestId('register-lastname');
      if (await lastNameField.isVisible()) {
        await lastNameField.fill(testUser.lastName);
      }
    }
    
    // Submit registration
    await this.page.getByTestId('register-submit').click();
    
    // Wait for successful registration (redirect to login or dashboard)
    await this.page.waitForURL(/\/(login|dashboard)/, { timeout: 10000 });
    
    // If redirected to login, log in
    if (this.page.url().includes('/login')) {
      const loginPage = new LoginPage(this.page);
      await loginPage.loginWithTestUser(testUser);
    }
    
    return testUser;
  }

  /**
   * Upload a file and wait for processing
   * @returns File ID of the uploaded file
   */
  async uploadFileSuccessfully(filePath?: string): Promise<string> {
    const testFile = filePath || 'e2e/fixtures/test-presentation.pptx';
    
    // Navigate to upload page
    await this.page.getByTestId('new-upload-link').click();
    await this.page.waitForURL('**/upload', { timeout: 5000 });
    
    // Upload file
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Wait for file to be recognized
    await this.page.waitForSelector('[data-testid="file-info"]', { timeout: 5000 });
    
    // Click upload button
    await this.page.getByTestId('upload-submit').click();
    
    // Wait for redirect to dashboard with success
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Extract file ID from the newly created file row
    const fileRow = this.page.getByTestId('file-row').first();
    const fileId = await fileRow.getAttribute('data-file-id');
    
    if (!fileId) {
      throw new Error('Failed to get file ID after upload');
    }
    
    return fileId;
  }

  /**
   * Translate a file end-to-end
   * @param fileId The file to translate
   * @param targetLanguage Target language code
   * @returns Translation job ID
   */
  async translateFile(fileId: string, targetLanguage: string = 'ja'): Promise<string> {
    // Navigate to file's preview page
    await this.page.goto(`/preview/${fileId}`);
    
    // Wait for text extraction to complete
    await this.page.waitForSelector('[data-testid="slide-text"]', { 
      state: 'visible',
      timeout: 30000 
    });
    
    // Select target language
    const languageSelect = this.page.getByTestId('target-language-select');
    await languageSelect.selectOption(targetLanguage);
    
    // Start translation
    await this.page.getByTestId('translate-button').click();
    
    // Wait for translation to complete
    await this.page.waitForSelector('[data-testid="translated-text"]', {
      state: 'visible',
      timeout: 60000
    });
    
    // Get translation job ID
    const jobId = await this.page.getByTestId('translation-job-id').textContent();
    
    return jobId || 'unknown';
  }

  /**
   * Download a translated file
   * @param fileId The file to download
   * @returns Download path
   */
  async downloadTranslatedFile(fileId: string): Promise<string> {
    // Navigate to dashboard
    await this.page.goto('/dashboard');
    
    // Find the file row
    const fileRow = this.page.locator(`[data-file-id="${fileId}"]`);
    
    // Click download translated button
    const downloadButton = fileRow.getByTestId('download-translated');
    
    // Wait for download
    const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 });
    await downloadButton.click();
    
    const download = await downloadPromise;
    const path = await download.path();
    
    if (!path) {
      throw new Error('Download failed - no path returned');
    }
    
    return path;
  }

  /**
   * Complete end-to-end flow: Register → Upload → Translate → Download
   * @returns Object with user, fileId, and download path
   */
  async completeFullUserJourney(): Promise<{
    user: TestUser;
    fileId: string;
    downloadPath: string;
  }> {
    // 1. Register and login
    const user = await this.registerAndLogin();
    
    // 2. Upload a file
    const fileId = await this.uploadFileSuccessfully();
    
    // 3. Translate the file
    await this.translateFile(fileId, 'en');
    
    // 4. Download the translated file
    const downloadPath = await this.downloadTranslatedFile(fileId);
    
    return {
      user,
      fileId,
      downloadPath
    };
  }

  /**
   * Validate that error messages are user-friendly
   * @param action Function that triggers an error
   * @returns Whether the error message is helpful
   */
  async validateErrorMessage(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      return false; // No error occurred
    } catch {
      // Look for error messages in common locations
      const errorSelectors = [
        '[data-testid="error-message"]',
        '[role="alert"]',
        '.error-message',
        '.text-red-600',
        '.text-red-500'
      ];
      
      for (const selector of errorSelectors) {
        const errorElement = this.page.locator(selector).first();
        if (await errorElement.isVisible({ timeout: 2000 })) {
          const errorText = await errorElement.textContent();
          
          // Check if error message is user-friendly
          if (errorText) {
            const isUserFriendly = 
              errorText.length > 10 && // Has meaningful content
              !errorText.includes('undefined') && // No technical errors
              !errorText.includes('null') && // No technical errors
              !errorText.includes('Error:') && // No raw error objects
              !errorText.includes('stack') && // No stack traces
              !/\b[A-Z_]{2,}\b/.test(errorText); // No CONSTANT_CASE technical terms
            
            return isUserFriendly;
          }
        }
      }
      
      return false;
    }
  }

  /**
   * Verify accessibility of current page
   * @returns Object with accessibility issues
   */
  async checkAccessibility(): Promise<{
    hasAltText: boolean;
    hasAriaLabels: boolean;
    hasProperHeadings: boolean;
    isKeyboardNavigable: boolean;
  }> {
    // Check for images without alt text
    const imagesWithoutAlt = await this.page.locator('img:not([alt])').count();
    const hasAltText = imagesWithoutAlt === 0;
    
    // Check for interactive elements with aria-labels
    const buttonsWithoutLabel = await this.page.locator('button:not([aria-label]):not(:has-text(*))').count();
    const hasAriaLabels = buttonsWithoutLabel === 0;
    
    // Check heading hierarchy
    const h1Count = await this.page.locator('h1').count();
    const hasProperHeadings = h1Count === 1; // Should have exactly one h1
    
    // Check if all interactive elements are keyboard accessible
    const nonAccessibleElements = await this.page.locator('*[onclick]:not(button):not(a):not(input):not([tabindex])').count();
    const isKeyboardNavigable = nonAccessibleElements === 0;
    
    return {
      hasAltText,
      hasAriaLabels,
      hasProperHeadings,
      isKeyboardNavigable
    };
  }

  /**
   * Measure and validate performance metrics
   * @returns Performance metrics
   */
  async measurePerformance(): Promise<{
    pageLoadTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    timeToInteractive: number;
  }> {
    const metrics = await this.page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        pageLoadTime: perf.loadEventEnd - perf.fetchStart,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        largestContentfulPaint: 0, // Would need PerformanceObserver for this
        timeToInteractive: perf.domInteractive - perf.fetchStart
      };
    });
    
    return metrics;
  }

  /**
   * Clean up test data after test completion
   */
  async cleanupTestData(user: TestUser, fileIds: string[]) {
    // This would typically call an admin API or database cleanup
    // For now, we'll just delete files through the UI
    
    await this.page.goto('/dashboard');
    
    for (const fileId of fileIds) {
      const fileRow = this.page.locator(`[data-file-id="${fileId}"]`);
      if (await fileRow.isVisible()) {
        const deleteButton = fileRow.getByTestId('delete-button');
        await deleteButton.click();
        
        // Confirm deletion if dialog appears
        const confirmButton = this.page.getByTestId('delete-confirm');
        if (await confirmButton.isVisible({ timeout: 1000 })) {
          await confirmButton.click();
        }
        
        // Wait for file to be removed
        await fileRow.waitFor({ state: 'hidden', timeout: 5000 });
      }
    }
    
    console.log(`Cleaned up test data for user: ${user.email}`);
  }
}
import { test, expect } from '@playwright/test';

test.describe('Direct Login Test', () => {
  test('Login with test@example.com', async ({ page }) => {
    // Navigate directly to login page
    await page.goto('http://localhost:3001/login');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on the login page
    const url = page.url();
    console.log('Current URL:', url);
    
    // Try to find the email input using multiple strategies
    const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 5000 }).catch(() => null);
    
    if (!emailInput) {
      // Take a screenshot to see what's on the page
      await page.screenshot({ path: 'login-page-debug.png' });
      throw new Error('Could not find email input field');
    }
    
    // Fill in credentials
    await emailInput.fill('test@example.com');
    
    const passwordInput = await page.locator('input[type="password"]').first();
    await passwordInput.fill('Test123!');
    
    // Click submit button
    const submitButton = await page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Wait for navigation or error
    const response = await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 10000 }).then(() => 'dashboard'),
      page.waitForSelector('text=/Invalid credentials/i', { timeout: 5000 }).then(() => 'error'),
      page.waitForTimeout(10000).then(() => 'timeout')
    ]);
    
    if (response === 'dashboard') {
      console.log('✅ Successfully logged in and redirected to dashboard');
      expect(page.url()).toContain('/dashboard');
    } else if (response === 'error') {
      console.log('❌ Login failed with invalid credentials');
      throw new Error('Login failed - check credentials');
    } else {
      console.log('⚠️ Login timeout - no response');
      const currentUrl = page.url();
      console.log('Still on:', currentUrl);
      
      // Check console for errors
      page.on('console', msg => console.log('Browser console:', msg.text()));
      
      throw new Error('Login timeout');
    }
  });
});
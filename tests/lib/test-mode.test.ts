import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  isTestMode,
  isAuthBypassEnabled,
  isMSWEnabled,
  getTestCredentials,
  getTestTimeout,
  getNavigationTimeout,
  getRetryConfig,
  getApiEndpoint
} from '@/lib/test-mode';

describe('test-mode', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment to original state
    jest.resetModules();
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  afterEach(() => {
    // Restore original environment
    jest.resetModules();
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, originalEnv);
  });

  describe('isTestMode', () => {
    it('should return true when NEXT_PUBLIC_TEST_MODE is true', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isTestMode()).toBe(true);
    });

    it('should return true when NODE_ENV is test', () => {
      // Use type assertion to bypass readonly restriction
      (process.env as any).NODE_ENV = 'test';
      expect(isTestMode()).toBe(true);
    });

    it('should return false in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      expect(isTestMode()).toBe(false);
    });
  });

  describe('getTestCredentials', () => {
    it('should NEVER return credentials in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.TEST_USER_EMAIL = 'test@example.com';
      process.env.TEST_USER_PASSWORD = 'password123';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return null when not in test mode', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      process.env.TEST_USER_EMAIL = 'test@example.com';
      process.env.TEST_USER_PASSWORD = 'password123';
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return null when credentials are not set', () => {
      (process.env as any).NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      delete process.env.TEST_USER_EMAIL;
      delete process.env.TEST_USER_PASSWORD;
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return credentials only in test mode with env vars', () => {
      (process.env as any).NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      process.env.TEST_USER_EMAIL = 'test@example.com';
      process.env.TEST_USER_PASSWORD = 'password123';
      
      const creds = getTestCredentials();
      expect(creds).toEqual({
        email: 'test@example.com',
        password: 'password123'
      });
    });
  });

  describe('isAuthBypassEnabled', () => {
    it('should return true when TEST_BYPASS_AUTH is true', () => {
      process.env.TEST_BYPASS_AUTH = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isAuthBypassEnabled()).toBe(true);
    });

    it('should return false when TEST_BYPASS_AUTH is false', () => {
      process.env.TEST_BYPASS_AUTH = 'false';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('should return false when not in test mode', () => {
      process.env.TEST_BYPASS_AUTH = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      expect(isAuthBypassEnabled()).toBe(false);
    });
  });

  describe('isMSWEnabled', () => {
    it('should return true when USE_MSW_MOCKS is true', () => {
      process.env.USE_MSW_MOCKS = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isMSWEnabled()).toBe(true);
    });

    it('should return false when USE_MSW_MOCKS is false', () => {
      process.env.USE_MSW_MOCKS = 'false';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      (process.env as any).NODE_ENV = 'test';
      expect(isMSWEnabled()).toBe(false);
    });

    it('should return false in production', () => {
      process.env.USE_MSW_MOCKS = 'true';
      (process.env as any).NODE_ENV = 'production';
      expect(isMSWEnabled()).toBe(false);
    });
  });

  describe('getTestTimeout', () => {
    it('should return custom timeout when set', () => {
      process.env.TEST_TIMEOUT = '5000';
      expect(getTestTimeout()).toBe(5000);
    });

    it('should return default timeout when not set', () => {
      delete process.env.TEST_TIMEOUT;
      (process.env as any).NODE_ENV = 'test';
      expect(getTestTimeout()).toBe(30000);
    });

    it('should return 0 when not in test mode', () => {
      process.env.TEST_TIMEOUT = '5000';
      (process.env as any).NODE_ENV = 'production';
      expect(getTestTimeout()).toBe(0);
    });
  });

  describe('getNavigationTimeout', () => {
    it('should return custom navigation timeout when set', () => {
      process.env.TEST_NAVIGATION_TIMEOUT = '10000';
      (process.env as any).NODE_ENV = 'test';
      expect(getNavigationTimeout()).toBe(10000);
    });

    it('should return default navigation timeout when not set', () => {
      delete process.env.TEST_NAVIGATION_TIMEOUT;
      (process.env as any).NODE_ENV = 'test';
      expect(getNavigationTimeout()).toBe(15000);
    });

    it('should return 0 when not in test mode', () => {
      process.env.TEST_NAVIGATION_TIMEOUT = '10000';
      (process.env as any).NODE_ENV = 'production';
      expect(getNavigationTimeout()).toBe(0);
    });
  });

  describe('getRetryConfig', () => {
    it('should return custom retry config when set', () => {
      process.env.TEST_RETRY_COUNT = '3';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      
      const config = getRetryConfig();
      expect(config.count).toBe(3);
      expect(config.delay).toBe(1000);
    });

    it('should return default retry config when not set', () => {
      delete process.env.TEST_RETRY_COUNT;
      (process.env as any).NODE_ENV = 'test';
      
      const config = getRetryConfig();
      expect(config.count).toBe(2);
      expect(config.delay).toBe(1000);
    });

    it('should disable retries when not in test mode', () => {
      process.env.TEST_RETRY_COUNT = '3';
      (process.env as any).NODE_ENV = 'production';
      
      const config = getRetryConfig();
      expect(config.count).toBe(3);
      expect(config.delay).toBe(2000);
    });
  });

  describe('getApiEndpoint', () => {
    it('should return API endpoint with base URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      expect(getApiEndpoint('/test')).toBe('https://example.com/api/test');
    });

    it('should return API endpoint with localhost when base URL not set', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getApiEndpoint('/test')).toBe('http://localhost:3000/api/test');
    });

    it('should handle endpoint without leading slash', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      expect(getApiEndpoint('test')).toBe('https://example.com/api/test');
    });
  });
});
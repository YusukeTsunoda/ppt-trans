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
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isTestMode', () => {
    it('should return true when NEXT_PUBLIC_TEST_MODE is true', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isTestMode()).toBe(true);
    });

    it('should return true when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      expect(isTestMode()).toBe(true);
    });

    it('should return false in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      expect(isTestMode()).toBe(false);
    });
  });

  describe('getTestCredentials', () => {
    it('should NEVER return credentials in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_USER_EMAIL = 'test@example.com';
      process.env.TEST_USER_PASSWORD = 'password123';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return null when not in test mode', () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      process.env.TEST_USER_EMAIL = 'test@example.com';
      process.env.TEST_USER_PASSWORD = 'password123';
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return null when credentials are not set', () => {
      process.env.NODE_ENV = 'test';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      delete process.env.TEST_USER_EMAIL;
      delete process.env.TEST_USER_PASSWORD;
      
      const creds = getTestCredentials();
      expect(creds).toBeNull();
    });

    it('should return credentials only in test mode with env vars', () => {
      process.env.NODE_ENV = 'test';
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
    it('should only work in test mode', () => {
      process.env.TEST_BYPASS_AUTH = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('should work when both flags are enabled', () => {
      process.env.TEST_BYPASS_AUTH = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isAuthBypassEnabled()).toBe(true);
    });
  });

  describe('isMSWEnabled', () => {
    it('should only work in test mode', () => {
      process.env.USE_MSW_MOCKS = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'false';
      expect(isMSWEnabled()).toBe(false);
    });

    it('should work when both flags are enabled', () => {
      process.env.USE_MSW_MOCKS = 'true';
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(isMSWEnabled()).toBe(true);
    });
  });

  describe('getTestTimeout', () => {
    it('should return default timeout in production', () => {
      process.env.NODE_ENV = 'production';
      expect(getTestTimeout(5000)).toBe(5000);
    });

    it('should double timeout in test mode without env var', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(getTestTimeout(5000)).toBe(10000);
    });

    it('should use TEST_TIMEOUT env var when set', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      process.env.TEST_TIMEOUT = '30000';
      expect(getTestTimeout(5000)).toBe(30000);
    });
  });

  describe('getNavigationTimeout', () => {
    it('should return 10000 in production', () => {
      process.env.NODE_ENV = 'production';
      expect(getNavigationTimeout()).toBe(10000);
    });

    it('should return 15000 in test mode', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(getNavigationTimeout()).toBe(15000);
    });

    it('should use TEST_NAVIGATION_TIMEOUT when set', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      process.env.TEST_NAVIGATION_TIMEOUT = '20000';
      expect(getNavigationTimeout()).toBe(20000);
    });
  });

  describe('getRetryConfig', () => {
    it('should return production config when not in test mode', () => {
      process.env.NODE_ENV = 'production';
      expect(getRetryConfig()).toEqual({
        count: 3,
        delay: 2000
      });
    });

    it('should return test config in test mode', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      expect(getRetryConfig()).toEqual({
        count: 2,
        delay: 1000
      });
    });

    it('should use TEST_RETRY_COUNT when set', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      process.env.TEST_RETRY_COUNT = '5';
      expect(getRetryConfig()).toEqual({
        count: 5,
        delay: 1000
      });
    });
  });

  describe('getApiEndpoint', () => {
    it('should return path as-is in production', () => {
      process.env.NODE_ENV = 'production';
      expect(getApiEndpoint('/api/test')).toBe('/api/test');
    });

    it('should prepend base URL in test mode', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      expect(getApiEndpoint('/api/test')).toBe('http://localhost:3000/api/test');
    });

    it('should use default URL when not set', () => {
      process.env.NEXT_PUBLIC_TEST_MODE = 'true';
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getApiEndpoint('/api/test')).toBe('http://localhost:3001/api/test');
    });
  });
});
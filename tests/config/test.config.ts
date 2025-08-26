/**
 * Centralized test configuration
 * Provides consistent test setup across all test suites
 */

export const TEST_CONFIG = {
  // Timeouts
  timeouts: {
    unit: 5000,
    integration: 15000,
    e2e: 30ためす000,
    async: 10000,
  },
  
  // Mock delays
  mockDelays: {
    api: 100,
    database: 50,
    storage: 150,
    auth: 200,
  },
  
  // Test data
  testData: {
    defaultUser: {
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
    },
    adminUser: {
      id: 'admin-user-456',
      email: 'admin@example.com',
      role: 'admin',
    },
    testFile: {
      name: 'test-presentation.pptx',
      size: 1024 * 1024, // 1MB
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
  },
  
  // Environment
  env: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    baseUrl: 'http://localhost:3000',
    apiUrl: 'http://localhost:3000/api',
  },
  
  // Feature flags for tests
  features: {
    enableNetworkStubs: true,
    enableConsoleCapture: true,
    enablePerformanceTracking: true,
    enableDetailedErrors: true,
  },
  
  // Retry configuration
  retry: {
    times: 3,
    delay: 1000,
    backoff: 2,
  },
} as const;

// Test environment setup
export function setupTestEnvironment() {
  // Set environment variables
  Object.entries(TEST_CONFIG.env).forEach(([key, value]) => {
    process.env[key.replace(/([A-Z])/g, '_$1').toUpperCase()] = value;
  });
  
  // Configure global test timeout
  if (typeof jest !== 'undefined') {
    jest.setTimeout(TEST_CONFIG.timeouts.unit);
  }
}

// Performance tracking
export class TestPerformanceTracker {
  private static instances = new Map<string, TestPerformanceTracker>();
  private metrics: Map<string, number[]> = new Map();
  
  static getInstance(suiteName: string): TestPerformanceTracker {
    if (!this.instances.has(suiteName)) {
      this.instances.set(suiteName, new TestPerformanceTracker());
    }
    return this.instances.get(suiteName)!;
  }
  
  recordMetric(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }
  
  getAverageTime(name: string): number {
    const times = this.metrics.get(name) || [];
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
  
  getReport() {
    const report: Record<string, any> = {};
    this.metrics.forEach((times, name) => {
      report[name] = {
        avg: this.getAverageTime(name),
        min: Math.min(...times),
        max: Math.max(...times),
        count: times.length,
      };
    });
    return report;
  }
}

// Test utilities
export const testUtils = {
  /**
   * Wait for a condition to be true
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout = TEST_CONFIG.timeouts.async,
    interval = 100
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  },
  
  /**
   * Retry a function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options = TEST_CONFIG.retry
  ): Promise<T> {
    let lastError: any;
    let delay = options.delay;
    
    for (let i = 0; i < options.times; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < options.times - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= options.backoff;
        }
      }
    }
    
    throw lastError;
  },
  
  /**
   * Create a deferred promise
   */
  createDeferred<T>() {
    let resolve: (value: T) => void;
    let reject: (error: any) => void;
    
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    
    return {
      promise,
      resolve: resolve!,
      reject: reject!,
    };
  },
};

export default TEST_CONFIG;
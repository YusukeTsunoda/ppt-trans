import { RateLimiter } from '../../../src/lib/security/rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    // Clear any intervals to prevent memory leaks
    if (rateLimiter && typeof rateLimiter.cleanup === 'function') {
      rateLimiter.cleanup();
    }
  });

  test('creates rate limiter with default options', () => {
    expect(rateLimiter).toBeInstanceOf(RateLimiter);
  });

  test('allows requests within limit', () => {
    const key = 'test-key';
    const limit = 5;
    const windowMs = 60000;

    for (let i = 0; i < limit; i++) {
      const result = rateLimiter.checkLimit(key, limit, windowMs);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - i - 1);
    }
  });

  test('blocks requests exceeding limit', () => {
    const key = 'test-key';
    const limit = 3;
    const windowMs = 60000;

    // Use up all allowed requests
    for (let i = 0; i < limit; i++) {
      rateLimiter.checkLimit(key, limit, windowMs);
    }

    // Next request should be blocked
    const result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('resets counter after window expires', async () => {
    const key = 'test-key';
    const limit = 2;
    const windowMs = 10; // Very short window

    // Use up all requests
    rateLimiter.checkLimit(key, limit, windowMs);
    rateLimiter.checkLimit(key, limit, windowMs);

    // Should be blocked
    let result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    // Should be allowed again
    result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  test('handles multiple keys independently', () => {
    const limit = 3;
    const windowMs = 60000;

    const result1 = rateLimiter.checkLimit('key1', limit, windowMs);
    const result2 = rateLimiter.checkLimit('key2', limit, windowMs);

    expect(result1.allowed).toBe(true);
    expect(result2.allowed).toBe(true);
    expect(result1.remaining).toBe(limit - 1);
    expect(result2.remaining).toBe(limit - 1);
  });

  test('returns correct remaining count', () => {
    const key = 'test-key';
    const limit = 5;
    const windowMs = 60000;

    for (let i = 0; i < limit; i++) {
      const result = rateLimiter.checkLimit(key, limit, windowMs);
      expect(result.remaining).toBe(limit - i - 1);
    }
  });

  test('returns reset time', () => {
    const key = 'test-key';
    const limit = 5;
    const windowMs = 60000;
    const beforeTime = Date.now();

    const result = rateLimiter.checkLimit(key, limit, windowMs);
    
    expect(result.resetTime).toBeGreaterThan(beforeTime);
    expect(result.resetTime).toBeLessThanOrEqual(beforeTime + windowMs);
  });

  test('handles concurrent requests correctly', () => {
    const key = 'concurrent-key';
    const limit = 10;
    const windowMs = 60000;
    const results: any[] = [];

    // Simulate concurrent requests
    for (let i = 0; i < 15; i++) {
      results.push(rateLimiter.checkLimit(key, limit, windowMs));
    }

    // First 10 should be allowed
    for (let i = 0; i < limit; i++) {
      expect(results[i].allowed).toBe(true);
    }

    // Remaining should be blocked
    for (let i = limit; i < results.length; i++) {
      expect(results[i].allowed).toBe(false);
    }
  });

  test('handles zero limit correctly', () => {
    const key = 'zero-limit-key';
    const limit = 0;
    const windowMs = 60000;

    const result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('handles negative limit correctly', () => {
    const key = 'negative-limit-key';
    const limit = -1;
    const windowMs = 60000;

    const result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('cleans up expired entries', async () => {
    const key = 'cleanup-key';
    const limit = 1;
    const windowMs = 5; // Very short window

    // Make a request
    rateLimiter.checkLimit(key, limit, windowMs);

    // Wait for entry to expire
    await new Promise(resolve => setTimeout(resolve, 10));

    // Trigger cleanup (this would normally happen automatically)
    if (typeof rateLimiter.cleanup === 'function') {
      rateLimiter.cleanup();
    }

    // Make another request - should be allowed if cleanup worked
    const result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(true);
  });

  test('handles very large limits', () => {
    const key = 'large-limit-key';
    const limit = 1000000;
    const windowMs = 60000;

    const result = rateLimiter.checkLimit(key, limit, windowMs);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  test('handles edge case of window expiring during check', () => {
    const key = 'edge-case-key';
    const limit = 2;
    const windowMs = 1; // 1ms window

    // Make first request
    const first = rateLimiter.checkLimit(key, limit, windowMs);
    expect(first.allowed).toBe(true);

    // Wait for window to almost expire, then make another request
    // This tests the edge case where the window expires between
    // checking and updating the counter
    setTimeout(() => {
      const second = rateLimiter.checkLimit(key, limit, windowMs);
      expect(second.allowed).toBe(true);
    }, 1);
  });
});
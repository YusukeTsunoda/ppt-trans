/**
 * Rate limiter for Server Actions
 * Implements token bucket algorithm with LRU cache
 */

import { LRUCache } from 'lru-cache';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  identifier: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Global rate limiter cache
const rateLimitCache = new LRUCache<string, RateLimitEntry>({
  max: 10000, // Maximum number of entries
  ttl: 60 * 60 * 1000, // 1 hour TTL
});

/**
 * Check if a request should be rate limited
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const now = Date.now();
  const key = config.identifier;
  const entry = rateLimitCache.get(key);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    const resetTime = now + config.windowMs;
    rateLimitCache.set(key, {
      count: 1,
      resetTime,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment counter
  entry.count++;
  rateLimitCache.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limiter configurations for different actions
 */
export const RATE_LIMITS = {
  // Translation actions - more restrictive
  translateTexts: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  translatePPTX: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
  },
  
  // File operations - moderate limits
  extractText: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
  },
  applyTranslations: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 15,
  },
  
  // Admin operations - lenient limits
  getActivities: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  checkAdminRole: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
  },
} as const;

/**
 * Create rate limiter for a specific action
 */
export function createRateLimiter(
  action: keyof typeof RATE_LIMITS,
  userId: string
): (additionalIdentifier?: string) => Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const config = RATE_LIMITS[action];
  
  return async (additionalIdentifier?: string) => {
    const identifier = additionalIdentifier 
      ? `${action}:${userId}:${additionalIdentifier}`
      : `${action}:${userId}`;
    
    return checkRateLimit({
      ...config,
      identifier,
    });
  };
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or admin overrides
 */
export function resetRateLimit(identifier: string): void {
  rateLimitCache.delete(identifier);
}

/**
 * Clear all rate limits
 * Only for testing purposes
 */
export function clearAllRateLimits(): void {
  if (process.env.NODE_ENV === 'test') {
    rateLimitCache.clear();
  }
}
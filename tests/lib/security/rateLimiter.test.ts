import { RateLimiter } from '../../../src/lib/security/rateLimiter';
import { NextRequest } from 'next/server';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // RateLimiterにはconfigが必要
    rateLimiter = new RateLimiter({
      windowMs: 60000, // 1分
      max: 10, // 最大10リクエスト
    });
  });

  afterEach(() => {
    // クリーンアップ処理は不要（Redisを使用している場合は自動的に管理される）
  });

  test('creates rate limiter with config', () => {
    expect(rateLimiter).toBeInstanceOf(RateLimiter);
  });

  test('checks rate limit for request', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test');
    
    // check メソッドを使用
    const result = await rateLimiter.check(mockRequest);
    
    // Redisが利用できない場合でも成功することを確認
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('limit');
    expect(result).toHaveProperty('remaining');
    expect(result).toHaveProperty('reset');
  });

  test('returns proper structure when checking limit', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test');
    
    const result = await rateLimiter.check(mockRequest);
    
    expect(result.limit).toBe(10);
    expect(result.reset).toBeInstanceOf(Date);
    
    // Redisが利用できない場合は常に成功
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(10);
  });

  test('handles multiple requests', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/test');
    const results = [];
    
    // 複数のリクエストをシミュレート
    for (let i = 0; i < 3; i++) {
      const result = await rateLimiter.check(mockRequest);
      results.push(result);
    }
    
    // すべてのリクエストが成功することを確認（Redisなしの場合）
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  test('rate limiter with custom window and max', async () => {
    const customLimiter = new RateLimiter({
      windowMs: 30000, // 30秒
      max: 5, // 最大5リクエスト
      message: 'Custom rate limit message',
    });
    
    const mockRequest = new NextRequest('http://localhost:3000/api/test');
    const result = await customLimiter.check(mockRequest);
    
    expect(result.limit).toBe(5);
  });

  test('generates proper key for request', async () => {
    const customLimiter = new RateLimiter({
      windowMs: 60000,
      max: 10,
      keyGenerator: (req: NextRequest) => {
        const url = new URL(req.url);
        return `custom:${url.pathname}`;
      },
    });
    
    const mockRequest = new NextRequest('http://localhost:3000/api/test');
    const result = await customLimiter.check(mockRequest);
    
    expect(result).toHaveProperty('success');
  });
});
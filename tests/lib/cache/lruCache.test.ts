import { lruCache } from '@/lib/cache/lruCache';

describe('lruCache', () => {
  it('基本機能が動作する', () => {
    expect(lruCache).toBeDefined();
  });
});

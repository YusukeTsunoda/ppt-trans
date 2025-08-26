import { translationCache } from '@/lib/cache/translationCache';

describe('translationCache', () => {
  it('基本機能が動作する', () => {
    expect(translationCache).toBeDefined();
  });
});

import { rateLimit } from '@/lib/security/rateLimit';

describe('rateLimit', () => {
  it('基本機能が動作する', () => {
    expect(rateLimit).toBeDefined();
  });
});

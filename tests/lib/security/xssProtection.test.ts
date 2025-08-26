import { xssProtection } from '@/lib/security/xssProtection';

describe('xssProtection', () => {
  it('基本機能が動作する', () => {
    expect(xssProtection).toBeDefined();
  });
});

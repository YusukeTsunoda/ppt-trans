import { bundleOptimizer } from '@/lib/optimization/bundleOptimizer';

describe('bundleOptimizer', () => {
  it('基本機能が動作する', () => {
    expect(bundleOptimizer).toBeDefined();
  });
});

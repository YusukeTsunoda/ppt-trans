import { renderHook } from '@testing-library/react';
import { useResponsive } from '@/hooks/useResponsive';

describe('useResponsive', () => {
  it('正しく初期化される', () => {
    const { result } = renderHook(() => useResponsive());
    expect(result.current).toBeDefined();
  });
});

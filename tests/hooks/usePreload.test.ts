import { renderHook } from '@testing-library/react';
import { usePreload } from '@/hooks/usePreload';

describe('usePreload', () => {
  it('正しく初期化される', () => {
    const { result } = renderHook(() => usePreload());
    expect(result.current).toBeDefined();
  });
});

import { renderHook } from '@testing-library/react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

describe('useIntersectionObserver', () => {
  it('正しく初期化される', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    expect(result.current).toBeDefined();
  });
});

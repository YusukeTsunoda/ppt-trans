import { renderHook } from '@testing-library/react';
import { usePreviewState } from '@/hooks/usePreviewState';

describe('usePreviewState', () => {
  it('正しく初期化される', () => {
    const { result } = renderHook(() => usePreviewState());
    expect(result.current).toBeDefined();
  });
});

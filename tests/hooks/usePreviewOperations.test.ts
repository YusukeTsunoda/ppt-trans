import { renderHook } from '@testing-library/react';
import { usePreviewOperations } from '@/hooks/usePreviewOperations';

describe('usePreviewOperations', () => {
  it('正しく初期化される', () => {
    const { result } = renderHook(() => usePreviewOperations());
    expect(result.current).toBeDefined();
  });
});

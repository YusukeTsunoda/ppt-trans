'use client';

import { usePreload } from '@/hooks/usePreload';

export function PreloadProvider({ children }: { children: React.ReactNode }) {
  // ルートベースのプリロード戦略を適用
  usePreload();
  
  return <>{children}</>;
}
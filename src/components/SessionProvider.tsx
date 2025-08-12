'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider
      // セッションの適切な更新設定
      refetchInterval={5 * 60} // 5分ごとに更新
      refetchOnWindowFocus={true} // ウィンドウフォーカス時の更新を有効化
    >
      {children}
    </NextAuthSessionProvider>
  );
}
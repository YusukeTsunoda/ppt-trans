'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NextAuthSessionProvider
      // セッションの自動更新を無効化
      // useSessionManagerで独自のセッション管理を行うため
      refetchInterval={0} // 自動更新を無効化
      refetchOnWindowFocus={false} // ウィンドウフォーカス時の更新を無効化
    >
      {children}
    </NextAuthSessionProvider>
  );
}
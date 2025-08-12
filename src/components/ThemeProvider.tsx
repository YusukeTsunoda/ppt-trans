'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);

  // React 19でのハイドレーション問題を回避
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // CSSが適用されるまでの間、CSS変数ベースのスタイルを使用
    return (
      <div className="bg-background text-foreground">
        {children}
      </div>
    );
  }

  // next-themesのデバッグUIを無効化するためのプロパティを追加
  const themeProps = {
    ...props,
    enableColorScheme: false,
    disableTransitionOnChange: true
  };

  return <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>;
}
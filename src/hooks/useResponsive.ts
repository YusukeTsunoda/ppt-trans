'use client';

import { useState, useEffect } from 'react';

// Tailwind CSSのブレークポイントに合わせる
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
  isExtraLarge: boolean;
  is2ExtraLarge: boolean;
  breakpoint: Breakpoint | 'xs';
  orientation: 'portrait' | 'landscape';
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isSmall: false,
        isMedium: false,
        isLarge: true,
        isExtraLarge: false,
        is2ExtraLarge: false,
        breakpoint: 'lg',
        orientation: 'landscape',
      };
    }

    return getResponsiveState();
  });

  useEffect(() => {
    const handleResize = () => {
      setState(getResponsiveState());
    };

    // 初期状態を設定
    handleResize();

    // リサイズイベントをリスナーに追加
    window.addEventListener('resize', handleResize);

    // オリエンテーション変更もリスナーに追加
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
}

function getResponsiveState(): ResponsiveState {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // ブレークポイントを判定
  let breakpoint: Breakpoint | 'xs' = 'xs';
  if (width >= breakpoints['2xl']) {
    breakpoint = '2xl';
  } else if (width >= breakpoints.xl) {
    breakpoint = 'xl';
  } else if (width >= breakpoints.lg) {
    breakpoint = 'lg';
  } else if (width >= breakpoints.md) {
    breakpoint = 'md';
  } else if (width >= breakpoints.sm) {
    breakpoint = 'sm';
  }

  return {
    width,
    height,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isSmall: width >= breakpoints.sm && width < breakpoints.md,
    isMedium: width >= breakpoints.md && width < breakpoints.lg,
    isLarge: width >= breakpoints.lg && width < breakpoints.xl,
    isExtraLarge: width >= breakpoints.xl && width < breakpoints['2xl'],
    is2ExtraLarge: width >= breakpoints['2xl'],
    breakpoint,
    orientation: width > height ? 'landscape' : 'portrait',
  };
}

// 特定のブレークポイント以上かどうかを判定するフック
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // モダンブラウザ対応
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // 古いブラウザ対応
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

// よく使うメディアクエリのプリセット
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)');
}

export function useIsTablet() {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLandscape() {
  return useMediaQuery('(orientation: landscape)');
}

export function useIsPortrait() {
  return useMediaQuery('(orientation: portrait)');
}
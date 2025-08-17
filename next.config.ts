import type { NextConfig } from "next";

// Bundle Analyzerの設定
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

const nextConfig: NextConfig = {
  // 画像最適化設定
  images: {
    domains: ['localhost', 'pptx-translator.vercel.app'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24, // 24時間
  },

  // モジュール最適化：アイコンライブラリのTree Shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{member}}'
    },
    '@heroicons/react/24/outline': {
      transform: '@heroicons/react/24/outline/{{member}}'
    },
    '@heroicons/react/24/solid': {
      transform: '@heroicons/react/24/solid/{{member}}'
    }
  },

  // バンドル分析（開発時のみ）
  webpack: (config, { dev, isServer }) => {
    // 開発環境ではwebpack設定をカスタマイズしない
    if (dev) {
      return config;
    }
    
    // 本番ビルドのバンドルサイズ最適化
    if (!dev && !isServer) {
      // ソースマップを無効化（本番環境）
      config.devtool = false;
    }

    return config;
  },

  // 実験的機能
  experimental: {
    // optimizeCss: true, // CSS最適化 - 一時的に無効化（CSS表示問題の対処）
    scrollRestoration: true, // スクロール位置の復元
    // serverActions: {
    //   bodySizeLimit: '2mb',
    // },
  },

  // Server Action安定化設定
  serverExternalPackages: [],
  skipTrailingSlashRedirect: true,

  // コンパイラー設定
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // ヘッダー設定（キャッシュ制御）
  async headers() {
    return [
      {
        source: '/(.*).(jpg|jpeg|png|gif|ico|svg)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*).(js|css|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Server Action のキャッシュを無効化
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'Next-Action',
          },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  // 圧縮設定
  compress: true,

  // PoweredByヘッダーを無効化
  poweredByHeader: false,

  // Strict Modeを有効化
  reactStrictMode: true,
};

// Bundle Analyzerをエクスポート
export default withBundleAnalyzer(nextConfig);

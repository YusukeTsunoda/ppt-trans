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
    // 本番ビルドのバンドルサイズ最適化
    if (!dev && !isServer) {
      // ソースマップを無効化（本番環境）
      config.devtool = false;
      
      // モジュールの最適化
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // ベンダーライブラリの分割
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test(module: any) {
                return module.size() > 160000 &&
                  /node_modules[\\/]/.test(module.identifier());
              },
              name(module: any) {
                const hash = require('crypto')
                  .createHash('sha1')
                  .update(module.identifier())
                  .digest('hex');
                return `lib-${hash.substring(0, 8)}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name(module: any, chunks: any) {
                return require('crypto')
                  .createHash('sha1')
                  .update(chunks.reduce((acc: string, chunk: any) => acc + chunk.name, ''))
                  .digest('hex');
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
        },
      };
    }

    // パフォーマンス警告の設定
    config.performance = {
      ...config.performance,
      maxEntrypointSize: 512000, // 500KB
      maxAssetSize: 512000, // 500KB
    };

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

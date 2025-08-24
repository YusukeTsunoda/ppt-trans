/** @type {import('next').NextConfig} */

const fs = require('fs');
const path = require('path');

// .env.buildから環境変数を読み込む
require('dotenv').config({ path: '.env.build' });

// ビルドメタデータの読み込み
function loadBuildMetadata() {
  try {
    const metadataPath = path.join(__dirname, '.next', 'build-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return metadata;
    }
  } catch (error) {
    console.warn('Failed to load build metadata:', error);
  }
  return null;
}

const buildMetadata = loadBuildMetadata();

const nextConfig = {
  // ビルドIDの設定
  generateBuildId: async () => {
    // 優先順位: 環境変数 > ビルドメタデータ > フォールバック
    if (process.env.BUILD_ID) {
      console.log(`Using build ID from env: ${process.env.BUILD_ID}`);
      return process.env.BUILD_ID;
    }
    
    if (buildMetadata?.buildId) {
      console.log(`Using build ID from metadata: ${buildMetadata.buildId}`);
      return buildMetadata.buildId;
    }
    
    // フォールバック: タイムスタンプベースのID
    const buildId = `${Date.now()}-${process.env.VERCEL_GIT_COMMIT_SHA || 'local'}`;
    console.log(`Generated fallback build ID: ${buildId}`);
    return buildId;
  },

  // 環境変数の設定
  env: {
    BUILD_ID: buildMetadata?.buildId || process.env.BUILD_ID || 'development',
    BUILD_TIMESTAMP: buildMetadata?.timestamp || new Date().toISOString(),
    DEPLOYMENT_TARGET: process.env.DEPLOYMENT_TARGET || 'local',
    USE_REQUEST_SCOPED_AUTH: process.env.USE_REQUEST_SCOPED_AUTH || 'true',
  },


  // 実験的機能の有効化
  experimental: {
    // Server Actionsの最適化
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    },
  },

  // TypeScript設定
  typescript: {
    // ビルド時の型チェックはprebuildで実行するため、ここではスキップ
    ignoreBuildErrors: false,
  },

  // ESLint設定
  eslint: {
    // ビルド時のlintチェックはprebuildで実行
    ignoreDuringBuilds: false,
    dirs: ['src', 'app', 'pages', 'components', 'lib'],
  },

  // ヘッダー設定
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Build-Id',
            value: buildMetadata?.buildId || 'unknown',
          },
          {
            key: 'X-Build-Time',
            value: buildMetadata?.timestamp || new Date().toISOString(),
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // リダイレクト設定
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Webpack設定
  webpack: (config, { isServer, dev }) => {
    // エイリアスの設定
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
    };

    // Critical dependency警告の抑制
    config.module.exprContextCritical = false;
    
    // OpenTelemetryの警告を抑制
    if (isServer) {
      config.externals.push({
        '@opentelemetry/instrumentation': 'commonjs @opentelemetry/instrumentation',
      });
    }

    // 警告の無視設定
    config.ignoreWarnings = [
      { module: /@opentelemetry\/instrumentation/ },
      { message: /Critical dependency/ },
    ];

    // Bundle Analyzerの設定
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
          openAnalyzer: false,
        })
      );
    }

    return config;
  },

  // 画像最適化の設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.com',
      },
    ],
  },

  // 出力設定
  output: 'standalone',
  

  // React Strict Modeの有効化
  reactStrictMode: true,

  // ページ拡張子の設定
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // トレイリングスラッシュの設定
  trailingSlash: false,

  // 国際化の設定（将来的な拡張用）
  i18n: undefined,
};

// Sentryなどのエラー監視ツールとの統合（本番環境のみ）
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(
    nextConfig,
    {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    },
    {
      widenClientFileUpload: true,
      transpileClientSDK: true,
      tunnelRoute: '/monitoring',
      hideSourceMaps: true,
      disableLogger: true,
    }
  );
} else {
  module.exports = nextConfig;
}
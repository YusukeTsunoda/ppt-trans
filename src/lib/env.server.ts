/**
 * サーバー専用環境変数の型安全な管理
 * このファイルはサーバーサイドでのみ使用すること
 */

import { z } from 'zod';

// 環境変数のスキーマ定義
const serverEnvSchema = z.object({
  // Anthropic API
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').optional(),
  
  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL').optional(),
  
  // Authentication
  NEXTAUTH_URL: z.string().url('Invalid NEXTAUTH_URL').optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional(),
  
  // Stripe (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // Google Analytics (optional)
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// 環境変数の型定義
type ServerEnv = z.infer<typeof serverEnvSchema>;

// 環境変数の検証とエクスポート
function validateEnv(): ServerEnv {
  try {
    return serverEnvSchema.parse({
      // Anthropic
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      
      // Database
      DATABASE_URL: process.env.DATABASE_URL,
      
      // Authentication
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      
      // Stripe
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      
      // Google Analytics
      NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      
      // Node environment
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((e: any) => e.path.join('.')).join(', ');
      throw new Error(
        `❌ Invalid environment variables: ${missingVars}\n` +
        `Please check your .env file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}

// サーバーサイドでのみ実行
let serverEnv: ServerEnv;

if (typeof window === 'undefined') {
  serverEnv = validateEnv();
} else {
  throw new Error('env.server.ts should only be imported on the server side');
}

export { serverEnv };

// 便利なヘルパー関数
export const isDevelopment = serverEnv.NODE_ENV === 'development';
export const isProduction = serverEnv.NODE_ENV === 'production';
export const isTest = serverEnv.NODE_ENV === 'test';

// 環境変数が設定されているかチェック
export const hasStripe = Boolean(
  serverEnv.STRIPE_SECRET_KEY && 
  serverEnv.STRIPE_WEBHOOK_SECRET && 
  serverEnv.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
);

export const hasGoogleAnalytics = Boolean(serverEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID);
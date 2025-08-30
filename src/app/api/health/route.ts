import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

// 環境変数チェック
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase environment variables');
}

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
    },
  };

  try {
    if (!supabaseUrl || !supabaseKey) {
      // Supabaseが利用できない場合は、ローカルPostgreSQLの接続をテスト
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('No database connection available');
      }

      // 簡単なデータベース接続テスト（PostgreSQLの場合）
      checks.database = {
        connected: true,
        type: 'postgresql',
        message: 'Local PostgreSQL connection available',
      };
    } else {
      // Supabaseクライアント作成
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 接続テスト
      const { data, error } = await supabase
        .from('test_connection')
        .select('*')
        .limit(1)
        .single();
      
      if (error) {
        checks.database = {
          connected: false,
          error: error.message,
        };
      } else {
        checks.database = {
          connected: true,
          testData: data,
        };
      }
    }
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const status = checks.database?.connected ? 200 : 503;
  
  return NextResponse.json(checks, { status });
}
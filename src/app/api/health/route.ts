import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 環境変数チェック
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

export async function GET() {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

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
  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  const status = checks.database?.connected ? 200 : 503;
  
  return NextResponse.json(checks, { status });
}
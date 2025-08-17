import { NextRequest, NextResponse } from 'next/server';
import { getRequestScopedSupabase } from '@/lib/auth/request-scoped-auth';

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  connections: {
    read: boolean;
    write: boolean;
  };
  performance: {
    queryTime: number;
    connectionTime: number;
  };
  tables: {
    [key: string]: {
      accessible: boolean;
      rowCount?: number;
    };
  };
  error?: string;
}

export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const health: DatabaseHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connections: {
      read: false,
      write: false
    },
    performance: {
      queryTime: 0,
      connectionTime: 0
    },
    tables: {}
  };

  try {
    // データベース接続の確立
    const connectionStart = Date.now();
    const supabase = await getRequestScopedSupabase();
    health.performance.connectionTime = Date.now() - connectionStart;

    // 読み取りテスト
    const readStart = Date.now();
    const { data: _profiles, error: readError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (!readError) {
      health.connections.read = true;
      health.tables.profiles = { accessible: true };
    } else {
      throw new Error(`Read test failed: ${readError.message}`);
    }

    // 各テーブルのアクセシビリティチェック
    const tablesToCheck = ['profiles', 'files', 'translations', 'activity_logs'];
    
    for (const table of tablesToCheck) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          health.tables[table] = {
            accessible: true,
            rowCount: count || 0
          };
        } else {
          health.tables[table] = {
            accessible: false
          };
          health.status = 'degraded';
        }
      } catch (_error) {
        health.tables[table] = {
          accessible: false
        };
        health.status = 'degraded';
      }
    }

    // 書き込みテスト（activity_logsテーブルを使用）
    const _writeStart = Date.now();
    const { error: writeError } = await supabase
      .from('activity_logs')
      .insert({
        user_id: 'health-check',
        action: 'health_check',
        description: 'Database health check',
        metadata: {
          timestamp: new Date().toISOString(),
          type: 'automated'
        }
      });
    
    if (!writeError) {
      health.connections.write = true;
      
      // クリーンアップ（古いヘルスチェックログを削除）
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      await supabase
        .from('activity_logs')
        .delete()
        .eq('user_id', 'health-check')
        .lt('created_at', oneHourAgo);
    } else {
      health.connections.write = false;
      health.status = 'degraded';
    }

    // パフォーマンス測定
    health.performance.queryTime = Date.now() - readStart;
    
    // パフォーマンス基準のチェック
    if (health.performance.queryTime > 2000) {
      health.status = 'degraded';
    }
    
    if (health.performance.connectionTime > 1000) {
      health.status = 'degraded';
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.error = error instanceof Error ? error.message : 'Unknown database error';
    
    return NextResponse.json(health, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  // ステータスコードの決定
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': (Date.now() - startTime).toString()
    }
  });
}
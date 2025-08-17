import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Roleキーを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkDatabaseTables() {
  console.log('=========================================');
  console.log('データベーステーブルの確認');
  console.log('=========================================\n');

  // テーブルの存在確認
  const tablesToCheck = [
    'profiles',
    'user_settings', 
    'files',
    'translations',
    'activity_logs',
    'usage_limits'
  ];

  for (const tableName of tablesToCheck) {
    console.log(`\nテーブル: ${tableName}`);
    console.log('-'.repeat(40));
    
    try {
      // テーブルから1行だけ取得を試みる
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(0);
      
      if (error) {
        if (error.message.includes('does not exist') || error.message.includes('not found')) {
          console.error(`❌ テーブルが存在しません`);
        } else {
          console.error(`⚠️  エラー: ${error.message}`);
        }
      } else {
        console.log(`✅ テーブル存在 (行数: ${count ?? 'unknown'})`);
      }
    } catch (err) {
      console.error(`予期しないエラー:`, err);
    }
  }

  // filesテーブルの詳細確認
  console.log('\n\n=== filesテーブルの詳細確認 ===');
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('filesテーブルエラー:', error);
    } else {
      console.log('filesテーブルのカラム構造:');
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        // カラム情報を取得する別の方法
        const { data: columns, error: colError } = await supabase.rpc('get_table_columns', {
          table_name: 'files'
        }).single();
        
        if (colError) {
          console.log('カラム情報取得エラー:', colError.message);
        } else {
          console.log('カラム:', columns);
        }
      }
    }
  } catch (err) {
    console.error('詳細確認エラー:', err);
  }
}

// 実行
checkDatabaseTables()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
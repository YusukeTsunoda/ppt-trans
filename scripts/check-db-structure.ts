import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkDatabaseStructure() {
  console.log('=========================================');
  console.log('データベース構造の確認');
  console.log('=========================================\n');

  try {
    // 1. filesテーブルの存在確認
    console.log('📊 filesテーブルの構造:');
    const { data: filesData, error: filesError } = await supabase
      .from('files')
      .select('*')
      .limit(0);

    if (filesError) {
      console.error('❌ filesテーブルエラー:', filesError.message);
    } else {
      console.log('✅ filesテーブルが存在します');
    }

    // 2. テーブルのカラム情報を取得
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'files' })
      .single();

    if (!columnsError && columns) {
      console.log('\n📋 カラム一覧:');
      console.log(columns);
    }

    // 3. profilesテーブルの管理者ロール確認
    console.log('\n👤 管理者ユーザーの確認:');
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, role, username, full_name')
      .or('role.eq.admin,role.eq.ADMIN');

    if (adminError) {
      console.error('❌ プロファイル取得エラー:', adminError.message);
    } else {
      console.log(`✅ 管理者数: ${admins?.length || 0}`);
      admins?.forEach(admin => {
        console.log(`   - ID: ${admin.id}, Role: ${admin.role}, Name: ${admin.full_name || admin.username || 'N/A'}`);
      });
    }

    // 4. テスト用にファイルレコードを作成
    console.log('\n🧪 テストファイルレコードの作成:');
    const testUserId = '40aeec28-4d6a-4054-b0d6-184841ec9a55'; // admin@example.comのID
    
    const { data: testFile, error: testError } = await supabase
      .from('files')
      .insert({
        user_id: testUserId,
        filename: 'test_file.pptx',
        original_filename: 'test_file.pptx',
        storage_path: 'test/path',
        file_size: 1024,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'uploaded'
      })
      .select()
      .single();

    if (testError) {
      console.error('❌ テストファイル作成エラー:', testError.message);
      console.error('   詳細:', testError);
    } else {
      console.log('✅ テストファイルが作成されました:', testFile.id);
      
      // 作成したテストファイルを削除
      await supabase
        .from('files')
        .delete()
        .eq('id', testFile.id);
      console.log('   テストファイルを削除しました');
    }

  } catch (error) {
    console.error('エラーが発生しました:', error);
  }

  console.log('\n=========================================');
  console.log('確認完了');
  console.log('=========================================');
}

// カラム情報を取得するための関数（存在しない場合はスキップ）
async function createGetColumnsFunction() {
  const functionSQL = `
    CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
    RETURNS json AS $$
    BEGIN
      RETURN (
        SELECT json_agg(
          json_build_object(
            'column_name', column_name,
            'data_type', data_type,
            'is_nullable', is_nullable,
            'column_default', column_default
          )
        )
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = get_table_columns.table_name
      );
    END;
    $$ LANGUAGE plpgsql;
  `;

  try {
    await supabase.rpc('exec_sql', { sql: functionSQL });
  } catch (error) {
    // 関数作成に失敗しても続行
  }
}

checkDatabaseStructure().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFilesConstraint() {
  console.log('=========================================');
  console.log('filesテーブルの制約を修正');
  console.log('=========================================\n');

  try {
    // SQLクエリを実行するためのRPC関数を作成
    const createFunction = `
      CREATE OR REPLACE FUNCTION fix_files_status_constraint()
      RETURNS void AS $$
      BEGIN
        -- 既存の制約を削除
        ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_status_check;
        
        -- 新しい制約を追加（uploadedを含む）
        ALTER TABLE public.files ADD CONSTRAINT files_status_check 
          CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'uploaded'));
      END;
      $$ LANGUAGE plpgsql;
    `;

    // 関数を作成（エラーを無視）
    try {
      await supabase.rpc('exec_sql', { sql: createFunction });
    } catch (e) {
      // エラーを無視
    }

    // 関数を実行
    const { error } = await supabase.rpc('fix_files_status_constraint');
    
    if (error) {
      console.error('❌ 制約の修正に失敗:', error.message);
      
      // 代替方法: マイグレーションファイルの作成を提案
      console.log('\n💡 代替方法:');
      console.log('以下のSQLを手動で実行してください:');
      console.log('----------------------------------------');
      console.log(`ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_status_check;`);
      console.log(`ALTER TABLE public.files ADD CONSTRAINT files_status_check`);
      console.log(`  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'uploaded'));`);
      console.log('----------------------------------------');
    } else {
      console.log('✅ status制約を修正しました');
      console.log('   uploadedステータスが使用可能になりました');
    }

    // テスト: uploadedステータスでレコードを作成
    console.log('\n🧪 修正後のテスト:');
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users?.users?.find(u => u.email === 'admin@example.com');
    
    if (testUser) {
      const testInsert = await supabase
        .from('files')
        .insert({
          user_id: testUser.id,
          filename: 'constraint_test.pptx',
          original_filename: 'constraint_test.pptx',
          storage_path: 'test/constraint',
          file_size: 1024,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          status: 'uploaded' // テスト: uploadedステータス
        })
        .select()
        .single();

      if (testInsert.error) {
        console.error('❌ uploadedステータスでエラー:', testInsert.error.message);
      } else {
        console.log('✅ uploadedステータスで成功!');
        // クリーンアップ
        await supabase.from('files').delete().eq('id', testInsert.data.id);
      }
    }

  } catch (error) {
    console.error('予期しないエラー:', error);
  }

  console.log('\n=========================================');
  console.log('完了');
  console.log('=========================================');
}

fixFilesConstraint().catch(console.error);
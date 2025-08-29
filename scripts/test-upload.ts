import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFileUpload() {
  console.log('=========================================');
  console.log('ファイルアップロードテスト');
  console.log('=========================================\n');

  try {
    // 1. filesテーブルの構造を確認
    console.log('📊 filesテーブルのカラム構造を確認:');
    
    // 空のレコードを取得してカラム名を確認
    const { data: sampleData, error: sampleError } = await supabase
      .from('files')
      .select('*')
      .limit(1);

    if (sampleData && sampleData.length > 0) {
      console.log('既存レコードのカラム:', Object.keys(sampleData[0]));
    } else {
      console.log('filesテーブルは空です');
    }

    // 2. テストユーザーIDを取得
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUser = users?.users?.find(u => u.email === 'admin@example.com');
    
    if (!testUser) {
      console.error('❌ テストユーザーが見つかりません');
      return;
    }

    console.log('\n👤 テストユーザー:', testUser.email);
    console.log('   ID:', testUser.id);

    // 3. 様々なカラム名の組み合わせを試す
    console.log('\n🧪 ファイルレコード作成テスト:');
    
    // パターン1: original_filename & storage_path (新しい構造)
    console.log('\nパターン1: original_filename & storage_path');
    const test1 = await supabase
      .from('files')
      .insert({
        user_id: testUser.id,
        filename: 'test1.pptx',
        original_filename: 'test_original1.pptx',
        storage_path: 'test/path1',
        file_size: 1024,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'uploaded'
      })
      .select()
      .single();

    if (test1.error) {
      console.error('❌ エラー:', test1.error.message);
      console.error('   コード:', test1.error.code);
      console.error('   詳細:', test1.error.details);
      console.error('   ヒント:', test1.error.hint);
    } else {
      console.log('✅ 成功! ID:', test1.data.id);
      // 削除
      await supabase.from('files').delete().eq('id', test1.data.id);
    }

    // パターン2: original_name & file_path (古い構造)
    console.log('\nパターン2: original_name & file_path');
    const test2 = await supabase
      .from('files')
      .insert({
        user_id: testUser.id,
        filename: 'test2.pptx',
        original_name: 'test_original2.pptx',
        file_path: 'test/path2',
        file_size: 1024,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'uploaded'
      })
      .select()
      .single();

    if (test2.error) {
      console.error('❌ エラー:', test2.error.message);
    } else {
      console.log('✅ 成功! ID:', test2.data.id);
      // 削除
      await supabase.from('files').delete().eq('id', test2.data.id);
    }

    // 4. 必須カラムのチェック
    console.log('\n📋 必須カラムのチェック:');
    const minimalTest = await supabase
      .from('files')
      .insert({
        user_id: testUser.id,
        filename: 'minimal.pptx',
        file_size: 1024,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        status: 'uploaded'
      })
      .select()
      .single();

    if (minimalTest.error) {
      console.error('❌ 最小限のカラムでエラー:', minimalTest.error.message);
      console.error('   必須カラムが不足している可能性があります');
    } else {
      console.log('✅ 最小限のカラムで成功!');
      console.log('   作成されたレコード:', minimalTest.data);
      // 削除
      await supabase.from('files').delete().eq('id', minimalTest.data.id);
    }

    // 5. RLSポリシーのチェック
    console.log('\n🔒 RLS（Row Level Security）のチェック:');
    const { data: rlsCheck, error: rlsError } = await supabase.rpc('check_rls_status');
    if (rlsError) {
      console.log('RLS状態を確認できませんでした');
    } else {
      console.log('RLS状態:', rlsCheck);
    }

  } catch (error) {
    console.error('予期しないエラー:', error);
  }

  console.log('\n=========================================');
  console.log('テスト完了');
  console.log('=========================================');
}

testFileUpload().catch(console.error);
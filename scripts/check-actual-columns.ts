import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkActualColumns() {
  console.log('=========================================');
  console.log('実際のfilesテーブル構造を確認');
  console.log('=========================================\n');

  try {
    // 空のSELECTクエリを実行してエラーメッセージからカラム名を推測
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .limit(1);

    if (data && data.length > 0) {
      console.log('📊 filesテーブルのサンプルデータ:');
      console.log('カラム名:', Object.keys(data[0]));
      console.log('\n実際のデータ:', data[0]);
    } else {
      console.log('⚠️ filesテーブルにデータがありません');
      
      // INSERTを試みてエラーメッセージを見る
      const testInsert = await supabase
        .from('files')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          filename: 'test.pptx',
          original_name: 'test.pptx', // 旧カラム名を試す
          file_size: 1024,
          mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          file_path: 'test/path', // 旧カラム名を試す
          status: 'uploaded'
        })
        .select();

      if (testInsert.error) {
        console.log('\n❌ 旧カラム名でのINSERTエラー:', testInsert.error.message);
        
        // 新カラム名を試す
        const testInsert2 = await supabase
          .from('files')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000000',
            filename: 'test.pptx',
            original_filename: 'test.pptx', // 新カラム名
            file_size: 1024,
            mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            storage_path: 'test/path', // 新カラム名
            status: 'uploaded'
          })
          .select();

        if (testInsert2.error) {
          console.log('\n❌ 新カラム名でのINSERTエラー:', testInsert2.error.message);
        } else {
          console.log('\n✅ 新カラム名でINSERT成功！');
          console.log('使用すべきカラム名:');
          console.log('  - original_filename');
          console.log('  - storage_path');
          
          // テストデータを削除
          if (testInsert2.data && testInsert2.data[0]) {
            await supabase
              .from('files')
              .delete()
              .eq('id', testInsert2.data[0].id);
          }
        }
      } else {
        console.log('\n✅ 旧カラム名でINSERT成功！');
        console.log('使用すべきカラム名:');
        console.log('  - original_name');
        console.log('  - file_path');
        
        // テストデータを削除
        if (testInsert.data && testInsert.data[0]) {
          await supabase
            .from('files')
            .delete()
            .eq('id', testInsert.data[0].id);
        }
      }
    }

  } catch (error) {
    console.error('エラーが発生しました:', error);
  }

  console.log('\n=========================================');
  console.log('確認完了');
  console.log('=========================================');
}

checkActualColumns().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ エラー: 環境変数が設定されていません');
  process.exit(1);
}

// Service Roleキーを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUsers() {
  console.log('=========================================');
  console.log('Supabaseに登録されているユーザー一覧');
  console.log('=========================================\n');
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Role Key (prefix):', supabaseServiceKey.substring(0, 20) + '...\n');

  try {
    // 全ユーザーをリスト
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ ユーザーリストの取得に失敗:', error.message);
      return;
    }
    
    if (!users || users.users.length === 0) {
      console.log('⚠️  ユーザーが登録されていません');
      return;
    }
    
    console.log(`✅ ${users.users.length}人のユーザーが見つかりました:\n`);
    
    users.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   作成日: ${new Date(user.created_at).toLocaleString('ja-JP')}`);
      console.log(`   最終ログイン: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ja-JP') : 'なし'}`);
      console.log(`   メール確認: ${user.email_confirmed_at ? '✅' : '❌'}`);
      console.log(`   メタデータ:`, user.user_metadata);
      console.log('');
    });
    
  } catch (err) {
    console.error('エラー:', err);
  }
}

// 実行
checkUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
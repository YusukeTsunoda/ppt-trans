import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('=========================================');
  console.log('ログインテスト');
  console.log('=========================================\n');

  const testAccounts = [
    { email: 'admin@example.com', password: 'Admin123!', role: 'admin' },
    { email: 'user1@example.com', password: 'User123!', role: 'user' },
  ];

  for (const account of testAccounts) {
    console.log(`\n📧 テスト: ${account.email}`);
    console.log(`🔐 パスワード: ${account.password}`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      console.error(`❌ ログイン失敗:`, error.message);
      console.error(`   エラーコード: ${error.code}`);
      console.error(`   ステータス: ${error.status}`);
    } else {
      console.log(`✅ ログイン成功!`);
      console.log(`   ユーザーID: ${data.user?.id}`);
      console.log(`   メールアドレス: ${data.user?.email}`);
      console.log(`   ロール: ${data.user?.user_metadata?.role || account.role}`);
      
      // ログアウト
      await supabase.auth.signOut();
      console.log(`   ログアウトしました`);
    }
  }

  console.log('\n=========================================');
  console.log('テスト完了');
  console.log('=========================================');
}

testLogin().catch(console.error);
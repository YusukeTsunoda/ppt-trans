import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ エラー: 環境変数が設定されていません');
  process.exit(1);
}

// Anon keyを使用してクライアントを作成（Next.jsと同じ設定）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAnonLogin() {
  console.log('=========================================');
  console.log('Anon Keyを使用したログインテスト');
  console.log('=========================================\n');
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Anon Key (prefix):', supabaseAnonKey.substring(0, 20) + '...\n');

  const testUser = {
    email: 'test@example.com',
    password: 'testpassword123'
  };

  try {
    console.log('ログイン試行中...');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });
    
    if (error) {
      console.error('\n❌ ログイン失敗:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
    } else {
      console.log('\n✅ ログイン成功!');
      console.log('Session ID:', data.session?.access_token?.substring(0, 20) + '...');
      console.log('User ID:', data.user?.id);
      console.log('User email:', data.user?.email);
    }
    
  } catch (err) {
    console.error('\n予期しないエラー:', err);
  }
}

// 実行
testAnonLogin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anon keyを使用してクライアントを作成（Next.jsと同じ設定）
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
  console.log('=========================================');
  console.log('新規登録テスト');
  console.log('=========================================\n');

  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const testUser = {
    email: `testuser${randomString}@example.com`,
    password: 'ValidPassword123!'
  };

  try {
    console.log('新規登録試行中...');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);
    
    const { data, error } = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
      options: {
        emailRedirectTo: `http://localhost:3000/auth/callback`,
      },
    });
    
    if (error) {
      console.error('\n❌ 登録失敗:', error.message);
      console.error('Error code:', error.code);
      console.error('Full error:', error);
    } else {
      console.log('\n✅ 登録成功!');
      console.log('User ID:', data.user?.id);
      console.log('User email:', data.user?.email);
      console.log('Session exists:', !!data.session);
      console.log('Email confirmed:', data.user?.email_confirmed_at);
      
      if (data.session) {
        console.log('\n📧 メール確認不要 - 直接ログイン可能');
      } else {
        console.log('\n📧 メール確認が必要です');
      }
    }
    
  } catch (err) {
    console.error('\n予期しないエラー:', err);
  }
}

// 実行
testSignup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
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

async function testSignupAdmin() {
  console.log('=========================================');
  console.log('Admin権限での新規ユーザー作成テスト');
  console.log('=========================================\n');

  const randomString = Math.random().toString(36).substring(2, 8);
  const testUser = {
    email: `newuser${randomString}@example.com`,
    password: 'ValidPassword123!',
    metadata: { role: 'user', name: `New User ${randomString}` }
  };

  try {
    console.log('新規ユーザー作成中...');
    console.log('Email:', testUser.email);
    
    // Admin APIで直接ユーザーを作成
    const { data, error } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true, // メール確認をスキップ
      user_metadata: testUser.metadata
    });
    
    if (error) {
      console.error('\n❌ 作成失敗:', error.message);
      console.error('Error code:', error.code);
    } else {
      console.log('\n✅ ユーザー作成成功!');
      console.log('User ID:', data.user?.id);
      console.log('User email:', data.user?.email);
      console.log('Email confirmed:', data.user?.email_confirmed_at);
      
      // 作成したユーザーでログインテスト
      console.log('\n📝 ログインテスト中...');
      
      // 通常のクライアントでログイン
      const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: loginData, error: loginError } = await anonClient.auth.signInWithPassword({
        email: testUser.email,
        password: testUser.password,
      });
      
      if (loginError) {
        console.error('❌ ログイン失敗:', loginError.message);
      } else {
        console.log('✅ ログイン成功!');
        console.log('Session exists:', !!loginData.session);
      }
    }
    
  } catch (err) {
    console.error('\n予期しないエラー:', err);
  }
}

// 実行
testSignupAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
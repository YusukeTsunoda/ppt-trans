import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anon keyを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignupDetailed() {
  console.log('=========================================');
  console.log('新規登録の詳細テスト');
  console.log('=========================================\n');
  
  console.log('環境情報:');
  console.log('  Supabase URL:', supabaseUrl);
  console.log('  Key prefix:', supabaseAnonKey.substring(0, 50) + '...\n');

  // 様々なメールアドレス形式をテスト
  const testEmails = [
    'test@gmail.com',
    'user@example.com', 
    'test123@test.com',
    'valid.email@domain.co.jp',
    'test_user@example.org'
  ];

  for (const email of testEmails) {
    console.log(`\nテスト: ${email}`);
    console.log('-'.repeat(40));
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: 'ValidPassword123!',
        options: {
          emailRedirectTo: `http://localhost:3000/auth/callback`,
        },
      });
      
      if (error) {
        console.error(`❌ 失敗: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        console.error(`   Status: ${(error as any).status}`);
      } else {
        console.log(`✅ 成功!`);
        console.log(`   User ID: ${data.user?.id}`);
        console.log(`   Session: ${data.session ? 'あり' : 'なし'}`);
        console.log(`   メール確認: ${data.user?.email_confirmed_at ? '済み' : '未確認'}`);
        
        // 作成されたユーザーを削除（テスト環境をクリーンに保つ）
        if (data.user) {
          // Service Roleで削除が必要
          console.log('   (注: テストユーザーの削除にはService Role権限が必要)');
        }
      }
    } catch (err) {
      console.error(`予期しないエラー:`, err);
    }
  }
}

// 実行
testSignupDetailed()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
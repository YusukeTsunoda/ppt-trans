import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Roleキーを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  console.log('Supabase Authにテストユーザーを作成します...\n');

  const users = [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin'
    },
    {
      email: 'user1@example.com',
      password: 'User123!',
      role: 'user'
    },
    {
      email: 'user2@example.com',
      password: 'User456!',
      role: 'user'
    }
  ];

  for (const user of users) {
    try {
      // ユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          role: user.role
        }
      });

      if (error) {
        console.error(`❌ ${user.email} の作成に失敗:`, error.message);
      } else {
        console.log(`✅ ${user.email} を作成しました`);
        console.log(`   パスワード: ${user.password}`);
        console.log(`   ロール: ${user.role}\n`);
      }
    } catch (err) {
      console.error(`エラー:`, err);
    }
  }

  console.log('\n完了しました！');
}

// 環境変数をロード
import * as dotenv from 'dotenv';
dotenv.config();

// 実行
createTestUsers().catch(console.error);
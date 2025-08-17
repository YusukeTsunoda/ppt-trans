import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ エラー: 環境変数が設定されていません');
  console.error('   NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
  process.exit(1);
}

// Service Roleキーを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  console.log('=========================================');
  console.log('Supabase Authにテストユーザーを作成');
  console.log('=========================================\n');

  const users = [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      metadata: { role: 'admin', name: 'Admin User' }
    },
    {
      email: 'user1@example.com',
      password: 'User123!',
      metadata: { role: 'user', name: 'Test User 1' }
    },
    {
      email: 'user2@example.com',
      password: 'User456!',
      metadata: { role: 'user', name: 'Test User 2' }
    }
  ];

  for (const user of users) {
    try {
      // 既存ユーザーをチェック
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.some((u: any) => u.email === user.email);

      if (userExists) {
        console.log(`⚠️  ${user.email} は既に存在します`);
        continue;
      }

      // ユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // メール確認をスキップ
        user_metadata: user.metadata
      });

      if (error) {
        console.error(`❌ ${user.email} の作成に失敗:`, error.message);
      } else {
        console.log(`✅ ${user.email} を作成しました`);
        console.log(`   パスワード: ${user.password}`);
        console.log(`   ロール: ${user.metadata.role}`);
        console.log(`   名前: ${user.metadata.name}\n`);

        // プロファイルを作成
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user?.id,
            username: user.email.split('@')[0],
            full_name: user.metadata.name,
            role: user.metadata.role
          });

        if (profileError) {
          console.error(`   ⚠️  プロファイルの作成に失敗:`, profileError.message);
        } else {
          console.log(`   ✅ プロファイルを作成しました`);
        }

        // ユーザー設定を作成
        const { error: settingsError } = await supabase
          .from('user_settings')
          .insert({
            user_id: data.user?.id,
            translation_model: 'claude-3-haiku-20240307',
            target_language: 'Japanese',
            batch_size: 5,
            auto_save: true,
            theme: 'light'
          });

        if (settingsError) {
          console.error(`   ⚠️  設定の作成に失敗:`, settingsError.message);
        } else {
          console.log(`   ✅ ユーザー設定を作成しました`);
        }
      }
    } catch (err) {
      console.error(`エラー:`, err);
    }
  }

  console.log('\n=========================================');
  console.log('完了しました！');
  console.log('=========================================');
  console.log('\nログインページでテストできます:');
  console.log('http://localhost:3000/login');
}

// 実行
createTestUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
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

async function createOrUpdateUsers() {
  console.log('=========================================');
  console.log('テストユーザーの作成/更新');
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
      console.log(`\n📧 処理中: ${user.email}`);
      
      // 既存ユーザーをチェック
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u: any) => u.email === user.email);

      let userId: string;
      
      if (existingUser) {
        console.log(`   ⚠️  ユーザーは既に存在します`);
        userId = existingUser.id;
        
        // パスワードを更新
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          { 
            password: user.password,
            user_metadata: user.metadata 
          }
        );
        
        if (updateError) {
          console.error(`   ❌ パスワード更新エラー:`, updateError.message);
        } else {
          console.log(`   ✅ パスワードを更新しました`);
        }
      } else {
        // 新規ユーザーを作成
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: user.metadata
        });

        if (error) {
          console.error(`   ❌ ユーザー作成エラー:`, error.message);
          continue;
        }
        
        userId = data.user!.id;
        console.log(`   ✅ 新規ユーザーを作成しました`);
      }

      console.log(`   パスワード: ${user.password}`);
      console.log(`   ロール: ${user.metadata.role}`);
      console.log(`   名前: ${user.metadata.name}`);

      // プロファイルを作成/更新（upsert）
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: user.email.split('@')[0],
          full_name: user.metadata.name,
          role: user.metadata.role
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error(`   ⚠️  プロファイルエラー:`, profileError.message);
      } else {
        console.log(`   ✅ プロファイルを作成/更新しました`);
      }

      // ユーザー設定を作成/更新（upsert）
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          translation_model: 'claude-3-5-haiku-20241022',
          target_language: 'ja',
          source_language: 'auto',
          batch_size: 5,
          auto_save: true,
          theme: 'light'
        }, {
          onConflict: 'user_id'
        });

      if (settingsError) {
        console.error(`   ⚠️  設定エラー:`, settingsError.message);
      } else {
        console.log(`   ✅ ユーザー設定を作成/更新しました`);
      }

    } catch (err) {
      console.error(`エラー:`, err);
    }
  }

  // 作成されたユーザーを確認
  console.log('\n=========================================');
  console.log('ユーザー一覧');
  console.log('=========================================');
  
  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const testUsers = allUsers?.users?.filter((u: any) => 
    u.email?.includes('@example.com')
  );

  if (testUsers && testUsers.length > 0) {
    console.log(`\n✅ 登録済みテストユーザー: ${testUsers.length}名`);
    testUsers.forEach((u: any) => {
      console.log(`   - ${u.email} (ID: ${u.id})`);
    });
  }

  console.log('\n=========================================');
  console.log('完了しました！');
  console.log('=========================================');
  console.log('\n🔑 ログイン情報:');
  console.log('管理者: admin@example.com / Admin123!');
  console.log('ユーザー1: user1@example.com / User123!');
  console.log('ユーザー2: user2@example.com / User456!');
  console.log('\nログインページ:');
  console.log('http://localhost:3000/login');
}

// 実行
createOrUpdateUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
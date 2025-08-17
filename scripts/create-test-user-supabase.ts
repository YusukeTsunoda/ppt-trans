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

async function createOrUpdateTestUser() {
  console.log('=========================================');
  console.log('E2Eテスト用ユーザーを作成/更新');
  console.log('=========================================\n');

  const testUser = {
    email: 'test@example.com',
    password: 'testpassword123',
    metadata: { role: 'user', name: 'Test User' }
  };

  try {
    // 既存ユーザーをチェック
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === testUser.email);

    if (existingUser) {
      console.log(`⚠️  ${testUser.email} は既に存在します`);
      console.log('   パスワードを更新します...');
      
      // パスワードを更新
      const { data, error } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: testUser.password }
      );

      if (error) {
        console.error(`❌ パスワード更新に失敗:`, error.message);
      } else {
        console.log(`✅ ${testUser.email} のパスワードを更新しました`);
        console.log(`   新しいパスワード: ${testUser.password}`);
      }
    } else {
      // 新規ユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true, // メール確認をスキップ
        user_metadata: testUser.metadata
      });

      if (error) {
        console.error(`❌ ${testUser.email} の作成に失敗:`, error.message);
      } else {
        console.log(`✅ ${testUser.email} を作成しました`);
        console.log(`   パスワード: ${testUser.password}`);
        console.log(`   ロール: ${testUser.metadata.role}`);
        
        // プロファイルを作成
        if (data.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              username: testUser.email.split('@')[0],
              full_name: testUser.metadata.name,
              role: testUser.metadata.role
            });

          if (profileError) {
            console.error(`   ⚠️  プロファイルの作成に失敗:`, profileError.message);
          } else {
            console.log(`   ✅ プロファイルを作成しました`);
          }
        }
      }
    }

    // ログインテスト
    console.log('\n========================================='  );
    console.log('ログインテストを実行...');
    const { data: session, error: loginError } = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (loginError) {
      console.error('❌ ログインテスト失敗:', loginError.message);
    } else {
      console.log('✅ ログインテスト成功!');
      console.log('   セッションID:', session.session?.access_token?.substring(0, 20) + '...');
    }

  } catch (err) {
    console.error(`エラー:`, err);
  }

  console.log('\n=========================================');
  console.log('完了しました！');
  console.log('=========================================');
  console.log('\nログイン情報:');
  console.log(`  Email: ${testUser.email}`);
  console.log(`  Password: ${testUser.password}`);
}

// 実行
createOrUpdateTestUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
import { createClient } from '@supabase/supabase-js';

// Local Supabase credentials
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetUsers() {
  console.log('🔄 ユーザーをリセットして再作成します...\n');
  
  const users = [
    {
      email: 'test@example.com',
      password: 'testpassword123',  // .envファイルに記載されているパスワード
      role: 'user',
      description: 'テストユーザー'
    },
    {
      email: 'admin@example.com',
      password: 'adminpassword123',
      role: 'admin',
      description: '管理者ユーザー'
    }
  ];
  
  for (const user of users) {
    try {
      // 既存ユーザーを削除
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);
      
      if (existingUser) {
        console.log(`🗑️ 既存の${user.description}を削除中...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
        if (deleteError) {
          console.error(`  ❌ 削除エラー: ${deleteError.message}`);
        } else {
          console.log(`  ✅ 削除完了`);
        }
      }
      
      // 新規ユーザーを作成
      console.log(`➕ ${user.description}を作成中...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          role: user.role
        }
      });
      
      if (createError) {
        console.error(`  ❌ 作成エラー: ${createError.message}`);
      } else {
        console.log(`  ✅ 作成完了`);
        console.log(`  📧 Email: ${user.email}`);
        console.log(`  🔑 Password: ${user.password}`);
        console.log(`  🏷️ Role: ${user.role}\n`);
      }
      
    } catch (error) {
      console.error(`❌ エラー (${user.email}):`, error);
    }
  }
  
  console.log('========================================');
  console.log('📝 ログイン情報まとめ');
  console.log('========================================');
  console.log('\nテストユーザー:');
  console.log('  📧 Email: test@example.com');
  console.log('  🔑 Password: testpassword123');
  console.log('\n管理者ユーザー:');
  console.log('  📧 Email: admin@example.com');
  console.log('  🔑 Password: adminpassword123');
  console.log('========================================\n');
  
  // ログインテスト
  console.log('🔐 ログインテスト...\n');
  
  for (const user of users) {
    console.log(`${user.description}でログイン試行...`);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password
    });
    
    if (error) {
      console.log(`  ❌ 失敗: ${error.message}`);
    } else if (data.user) {
      console.log(`  ✅ 成功！`);
      await supabase.auth.signOut();
    }
  }
  
  console.log('\n✨ セットアップ完了！');
  console.log('🌐 ログインページ: http://localhost:3001/login');
}

resetUsers().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
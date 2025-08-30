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

async function createLocalTestUsers() {
  console.log('🚀 ローカルSupabaseにテストユーザーを作成します...\n');
  
  const testUsers = [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin',
      description: '管理者ユーザー'
    },
    {
      email: 'test@example.com',
      password: 'Test123!',
      role: 'user',
      description: 'テストユーザー'
    }
  ];

  for (const user of testUsers) {
    try {
      // まず既存のユーザーを確認
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingUser) {
        console.log(`✅ ${user.description} は既に存在します`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🔑 Password: ${user.password}\n`);
      } else {
        // 新規ユーザーを作成
        const { data: newUser, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
          user_metadata: {
            role: user.role
          }
        });

        if (error) {
          console.error(`❌ ${user.description} の作成に失敗:`, error.message);
        } else {
          console.log(`✅ ${user.description} を作成しました`);
          console.log(`   📧 Email: ${user.email}`);
          console.log(`   🔑 Password: ${user.password}\n`);
        }
      }
    } catch (error) {
      console.error(`❌ エラー (${user.email}):`, error);
    }
  }

  console.log('\n========================================');
  console.log('📝 ログイン情報まとめ:');
  console.log('========================================');
  console.log('\n管理者ユーザー:');
  console.log('  📧 Email: admin@example.com');
  console.log('  🔑 Password: Admin123!');
  console.log('\nテストユーザー:');
  console.log('  📧 Email: test@example.com');
  console.log('  🔑 Password: Test123!');
  console.log('========================================\n');
  
  console.log('✨ 上記の情報でログインできます！');
  console.log('🌐 ログインページ: http://localhost:3001/login');
}

createLocalTestUsers().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
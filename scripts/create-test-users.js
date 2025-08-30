const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase Admin Client設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// テストユーザーデータ
const testUsers = [
  {
    email: 'admin@example.com',
    password: 'admin123456',
    user_metadata: {
      username: 'admin',
      full_name: 'System Administrator',
      role: 'admin'
    }
  },
  {
    email: 'user1@example.com',
    password: 'user123456',
    user_metadata: {
      username: 'user1',
      full_name: 'Test User 1',
      role: 'user'
    }
  },
  {
    email: 'user2@example.com',
    password: 'user123456',
    user_metadata: {
      username: 'user2',
      full_name: 'Test User 2',
      role: 'user'
    }
  }
];

async function createTestUsers() {
  console.log('Creating test users for local Supabase...\n');
  
  for (const userData of testUsers) {
    try {
      // まず既存ユーザーを削除（もし存在すれば）
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === userData.email);
      
      if (existingUser) {
        console.log(`Deleting existing user: ${userData.email}`);
        await supabase.auth.admin.deleteUser(existingUser.id);
      }
      
      // 新しいユーザーを作成
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: userData.user_metadata
      });
      
      if (error) {
        console.error(`Failed to create user ${userData.email}:`, error.message);
        continue;
      }
      
      console.log(`✅ Created user: ${userData.email}`);
      
      // プロファイルを作成/更新
      if (data?.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            username: userData.user_metadata.username,
            full_name: userData.user_metadata.full_name,
            role: userData.user_metadata.role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (profileError) {
          console.error(`Failed to create profile for ${userData.email}:`, profileError.message);
        } else {
          console.log(`  ✅ Profile created for ${userData.email}`);
        }
      }
      
    } catch (err) {
      console.error(`Error creating user ${userData.email}:`, err);
    }
  }
  
  console.log('\n========================================');
  console.log('Test Users Created Successfully!');
  console.log('========================================');
  console.log('\nYou can now login with:');
  console.log('Admin: admin@example.com / admin123456');
  console.log('User1: user1@example.com / user123456');
  console.log('User2: user2@example.com / user123456');
  console.log('========================================\n');
}

// 実行
createTestUsers().catch(console.error);
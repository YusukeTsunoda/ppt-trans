#!/usr/bin/env npx tsx
/**
 * Supabase ローカル環境にテストユーザーを作成するスクリプト
 * Service Role Keyを使用してAdmin APIで作成
 * TEST_USERS.mdに記載された全アカウントを作成
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupTestUsers() {
  console.log('🚀 Setting up test users for development environment...');
  console.log('Supabase URL:', supabaseUrl);
  
  // TEST_USERS.mdに記載された全テストユーザー
  const testUsers = [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      metadata: { 
        name: 'Admin User', 
        username: 'admin',
        theme: 'light',
        translation_model: 'claude-3-haiku-20240307',
        target_language: 'Japanese'
      }
    },
    {
      email: 'user1@example.com',
      password: 'User123!',
      metadata: { 
        name: 'Test User 1', 
        username: 'testuser1',
        theme: 'light',
        translation_model: 'claude-3-haiku-20240307',
        target_language: 'Japanese'
      }
    },
    {
      email: 'user2@example.com',
      password: 'User456!',
      metadata: { 
        name: 'Test User 2', 
        username: 'testuser2',
        theme: 'dark',
        translation_model: 'claude-3-5-sonnet-20240620',
        target_language: 'English'
      }
    },
    // 元のテストユーザーも保持（.envに記載）
    {
      email: 'test@example.com',
      password: 'testpassword123',
      metadata: { 
        name: 'Default Test User', 
        username: 'testuser',
        theme: 'light',
        translation_model: 'claude-3-haiku-20240307',
        target_language: 'Japanese'
      }
    }
  ];

  console.log(`\n📋 Creating ${testUsers.length} test users...`);

  for (const user of testUsers) {
    console.log(`\n📧 Processing ${user.email}...`);
    
    try {
      // 既存ユーザーを削除
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find(u => u.email === user.email);
      
      if (existingUser) {
        console.log(`  🗑️ Deleting existing user...`);
        const { error: deleteError } = await supabase.auth.admin.deleteUser(existingUser.id);
        if (deleteError) {
          console.error(`  ❌ Failed to delete: ${deleteError.message}`);
        } else {
          console.log(`  ✅ Deleted existing user`);
        }
      }
      
      // 新規ユーザーを作成
      console.log(`  ➕ Creating new user...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.metadata
      });
      
      if (createError) {
        console.error(`  ❌ Failed to create: ${createError.message}`);
        continue;
      }
      
      console.log(`  ✅ Created user: ${newUser.user?.id}`);
      console.log(`     Role: ${user.email === 'admin@example.com' ? 'admin' : 'user'}`);
      console.log(`     Username: ${user.metadata.username}`);
      
      // profilesテーブルにも登録（存在する場合）
      if (newUser.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: newUser.user.id,
            username: user.metadata.username,
            full_name: user.metadata.name,
            role: user.email === 'admin@example.com' ? 'admin' : 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (profileError) {
          console.log(`  ⚠️ Could not create profile (table might not exist): ${profileError.message}`);
        } else {
          console.log(`  ✅ Profile created`);
        }
      }
      
      // ログインテスト
      console.log(`  🔐 Testing login...`);
      const anonClient = createClient(
        supabaseUrl, 
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
      );
      
      const { data: session, error: loginError } = await anonClient.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });
      
      if (loginError) {
        console.error(`  ❌ Login test failed: ${loginError.message}`);
      } else {
        console.log(`  ✅ Login successful! Session created.`);
      }
    } catch (error) {
      console.error(`  ❌ Unexpected error: ${error}`);
    }
  }
  
  console.log('\n✨ Setup complete!');
  console.log('\n📝 Test Users Summary:');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ 👤 ADMIN Account                                        │');
  console.log('│   Email: admin@example.com                              │');
  console.log('│   Password: Admin123!                                   │');
  console.log('│   Role: admin (管理画面アクセス可能)                    │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ 👤 User 1                                               │');
  console.log('│   Email: user1@example.com                              │');
  console.log('│   Password: User123!                                    │');
  console.log('│   Role: user                                            │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ 👤 User 2                                               │');
  console.log('│   Email: user2@example.com                              │');
  console.log('│   Password: User456!                                    │');
  console.log('│   Role: user                                            │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ 👤 Default Test User (.env)                            │');
  console.log('│   Email: test@example.com                               │');
  console.log('│   Password: testpassword123                             │');
  console.log('│   Role: user                                            │');
  console.log('└─────────────────────────────────────────────────────────┘');
}

setupTestUsers().catch(console.error);
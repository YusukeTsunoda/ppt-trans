#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Local Supabase credentials
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Users to create
const users = [
  {
    email: 'test@example.com',
    password: 'testpassword123',
    role: 'user',
    full_name: 'Test User',
    username: 'testuser'
  },
  {
    email: 'admin@example.com',
    password: 'adminpassword123',
    role: 'admin',
    full_name: 'Admin User',
    username: 'admin'
  }
];

async function resetDatabase() {
  console.log('🔄 データベースをリセット中...\n');
  
  try {
    // Reset database
    const { stdout, stderr } = await execAsync('npx supabase db reset --local');
    if (stderr && !stderr.includes('warning')) {
      console.error('Reset error:', stderr);
    }
    console.log('✅ データベースのリセット完了');
    
    // Wait a bit for the database to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return true;
  } catch (error) {
    console.error('❌ データベースリセットエラー:', error.message);
    return false;
  }
}

async function createUser(userData) {
  try {
    console.log(`\n👤 ${userData.email} を作成中...`);
    
    // Delete existing user if any
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === userData.email);
    
    if (existingUser) {
      console.log('  既存ユーザーを削除中...');
      await supabase.auth.admin.deleteUser(existingUser.id);
    }
    
    // Create new user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        role: userData.role,
        full_name: userData.full_name,
        username: userData.username
      }
    });
    
    if (createError) {
      throw createError;
    }
    
    console.log('  ✅ ユーザー作成成功');
    
    // Create profile
    if (newUser?.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUser.user.id,
          username: userData.username,
          full_name: userData.full_name,
          role: userData.role
        });
      
      if (profileError) {
        console.log('  ⚠️ プロフィール作成エラー:', profileError.message);
      } else {
        console.log('  ✅ プロフィール作成成功');
      }
    }
    
    return newUser;
  } catch (error) {
    console.error(`  ❌ エラー: ${error.message}`);
    return null;
  }
}

async function testLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  await supabase.auth.signOut();
  return { success: true, user: data.user };
}

async function main() {
  console.log('=====================================================');
  console.log('PowerPoint Translation Tool - 開発環境セットアップ');
  console.log('=====================================================\n');
  
  // Step 1: Reset database
  console.log('ステップ 1: データベースリセット');
  console.log('-------------------------------------');
  const resetSuccess = await resetDatabase();
  
  if (!resetSuccess) {
    console.log('\n⚠️ データベースリセットをスキップして続行します...\n');
  }
  
  // Step 2: Create users
  console.log('\nステップ 2: ユーザー作成');
  console.log('-------------------------------------');
  
  for (const userData of users) {
    await createUser(userData);
  }
  
  // Step 3: Test login
  console.log('\nステップ 3: ログインテスト');
  console.log('-------------------------------------');
  
  for (const userData of users) {
    console.log(`\n🔐 ${userData.email} でログインテスト...`);
    const result = await testLogin(userData.email, userData.password);
    
    if (result.success) {
      console.log('  ✅ ログイン成功');
    } else {
      console.log(`  ❌ ログイン失敗: ${result.error}`);
    }
  }
  
  // Summary
  console.log('\n=====================================================');
  console.log('セットアップ完了！');
  console.log('=====================================================\n');
  console.log('📝 ログイン情報:');
  console.log('-------------------------------------');
  console.log('テストユーザー:');
  console.log('  Email: test@example.com');
  console.log('  Password: testpassword123');
  console.log('\n管理者ユーザー:');
  console.log('  Email: admin@example.com');
  console.log('  Password: adminpassword123');
  console.log('-------------------------------------');
  console.log('\n🌐 ログインページ: http://localhost:3001/login');
  console.log('📊 Supabase Studio: http://localhost:54323');
  console.log('\n✨ 開発を開始できます！');
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
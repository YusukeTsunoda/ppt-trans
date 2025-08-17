#!/usr/bin/env npx tsx
/**
 * Supabase ローカル環境にテストユーザーを作成するスクリプト
 * Service Role Keyを使用してAdmin APIで作成
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
  console.log('🚀 Setting up test users for E2E testing...');
  console.log('Supabase URL:', supabaseUrl);
  
  // テストユーザーの定義
  const testUsers = [
    {
      email: 'test@example.com',
      password: 'testpassword123',
      metadata: { name: 'Test User', role: 'user' }
    },
    {
      email: 'admin@example.com',
      password: 'adminpassword123',
      metadata: { name: 'Admin User', role: 'admin' }
    }
  ];

  for (const user of testUsers) {
    console.log(`\n📧 Processing ${user.email}...`);
    
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
  }
  
  console.log('\n✨ Setup complete!');
  console.log('Test users:');
  console.log('  - test@example.com / testpassword123');
  console.log('  - admin@example.com / adminpassword123');
}

setupTestUsers().catch(console.error);
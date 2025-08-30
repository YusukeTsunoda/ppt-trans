#!/usr/bin/env node

/**
 * Supabaseでテストユーザーを作成するスクリプト
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// 環境変数の読み込み
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEYが設定されていません');
  process.exit(1);
}

// Supabaseクライアント作成（サービスロールキーを使用）
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  console.log('🚀 テストユーザーの作成を開始します...');

  const testUsers = [
    {
      email: 'admin@example.com',
      password: 'Admin123!',
      username: 'admin',
      role: 'ADMIN'
    },
    {
      email: 'user1@example.com',
      password: 'User123!',
      username: 'testuser1',
      role: 'USER'
    },
    {
      email: 'user2@example.com',
      password: 'User456!',
      username: 'testuser2',
      role: 'USER'
    }
  ];

  for (const userData of testUsers) {
    try {
      // Supabase Authでユーザーを作成
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          username: userData.username,
          role: userData.role
        }
      });

      if (authError) {
        console.error(`❌ Auth エラー (${userData.email}):`, authError.message);
        continue;
      }

      // profilesテーブルにもレコードを作成
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          username: userData.username,
          full_name: userData.username,
          role: userData.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (dbError) {
        console.error(`❌ データベースエラー (${userData.email}):`, dbError.message);
        console.error('詳細:', dbError);
      } else {
        console.log(`✅ ユーザー作成成功: ${userData.email} (${userData.role})`);
      }
    } catch (error) {
      console.error(`❌ エラー (${userData.email}):`, error);
    }
  }

  console.log('\n📝 テストユーザー情報:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  testUsers.forEach(user => {
    console.log(`📧 ${user.email}`);
    console.log(`🔐 ${user.password}`);
    console.log(`👤 ${user.username} (${user.role})`);
    console.log('────────────────────────────────────');
  });
}

// 実行
createTestUsers()
  .then(() => {
    console.log('\n✨ テストユーザーの作成が完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ エラー:', error);
    process.exit(1);
  });
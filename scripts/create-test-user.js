#!/usr/bin/env node
/**
 * テストユーザーを作成するスクリプト
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// .env.testファイルを読み込む
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

// Supabaseクライアントを作成
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('エラー: SUPABASE_SERVICE_ROLE_KEYが設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// テストユーザー情報
const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
const testPassword = process.env.TEST_USER_PASSWORD || 'Test123!@#';

async function createTestUser() {
  try {
    console.log(`テストユーザーを作成中: ${testEmail}`);
    
    // 既存ユーザーを削除（存在する場合）
    try {
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      
      if (!listError && users) {
        const existingUser = users.users.find(user => user.email === testEmail);
        if (existingUser) {
          console.log(`既存ユーザーを削除中: ${existingUser.id}`);
          await supabase.auth.admin.deleteUser(existingUser.id);
        }
      }
    } catch (e) {
      console.log(`既存ユーザーの削除をスキップ: ${e.message}`);
    }
    
    // 新規ユーザーを作成
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // メール確認済みとして作成
      user_metadata: {
        email: testEmail,
        email_verified: true,
        phone_verified: false
      }
    });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ テストユーザーが作成されました: ${testEmail}`);
    console.log(`   ID: ${data.user.id}`);
    
  } catch (error) {
    console.error(`❌ エラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

createTestUser();
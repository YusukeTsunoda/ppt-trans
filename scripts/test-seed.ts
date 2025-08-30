#!/usr/bin/env tsx

/**
 * Test Data Seeding Script
 * E2Eテスト用のテストデータを作成します
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

// 環境変数の設定
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Supabaseクライアントの初期化
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// テストユーザーの定義
const TEST_USERS = [
  {
    email: 'test@example.com',
    password: 'Test123456!',
    profile: {
      name: 'Test User',
      role: 'user'
    }
  },
  {
    email: 'admin@test.com',
    password: 'Admin123456!',
    profile: {
      name: 'Admin User',
      role: 'admin'
    }
  },
  {
    email: 'user1@test.com',
    password: 'User123456!',
    profile: {
      name: 'User One',
      role: 'user'
    }
  },
  {
    email: 'user2@test.com',
    password: 'User123456!',
    profile: {
      name: 'User Two',
      role: 'user'
    }
  }
];

// カラー出力
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createTestUser(userData: typeof TEST_USERS[0]) {
  try {
    // ユーザーの作成
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // メール確認をスキップ
      user_metadata: {
        name: userData.profile.name,
        role: userData.profile.role
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        log(`  ⚠️  User ${userData.email} already exists`, 'yellow');
        return { skipped: true };
      }
      throw authError;
    }

    log(`  ✅ Created user: ${userData.email}`, 'green');

    // プロファイルの作成
    if (authData?.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: userData.email,
          name: userData.profile.name,
          role: userData.profile.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        log(`  ⚠️  Profile creation failed for ${userData.email}: ${profileError.message}`, 'yellow');
      } else {
        log(`  ✅ Created profile for: ${userData.email}`, 'green');
      }
    }

    return { success: true, userId: authData?.user?.id };
  } catch (error) {
    log(`  ❌ Failed to create user ${userData.email}: ${error}`, 'red');
    return { error };
  }
}

async function createTestFiles() {
  const testFilesDir = path.join(process.cwd(), 'e2e', 'test-files');
  
  try {
    // ディレクトリの作成
    await fs.mkdir(testFilesDir, { recursive: true });
    
    // サンプルPPTXファイルの生成（実際のPPTXファイルがない場合はダミー）
    const files = [
      { name: 'test-small.pptx', size: 1024 * 100 }, // 100KB
      { name: 'test-medium.pptx', size: 1024 * 1024 * 5 }, // 5MB
      { name: 'test-large.pptx', size: 1024 * 1024 * 20 }, // 20MB
    ];

    for (const file of files) {
      const filePath = path.join(testFilesDir, file.name);
      
      // ファイルが存在しない場合のみ作成
      try {
        await fs.access(filePath);
        log(`  ⚠️  File ${file.name} already exists`, 'yellow');
      } catch {
        // ダミーデータの作成（実際のPPTXではないが、テスト用途）
        const buffer = Buffer.alloc(file.size);
        await fs.writeFile(filePath, buffer);
        log(`  ✅ Created test file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'green');
      }
    }
  } catch (error) {
    log(`  ❌ Failed to create test files: ${error}`, 'red');
  }
}

async function setupStorageBuckets() {
  try {
    // ストレージバケットの作成
    const buckets = ['pptx-files', 'translated-files'];
    
    for (const bucketName of buckets) {
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint'
        ]
      });

      if (error) {
        if (error.message.includes('already exists')) {
          log(`  ⚠️  Storage bucket ${bucketName} already exists`, 'yellow');
        } else {
          throw error;
        }
      } else {
        log(`  ✅ Created storage bucket: ${bucketName}`, 'green');
      }
    }
  } catch (error) {
    log(`  ❌ Failed to create storage buckets: ${error}`, 'red');
  }
}

async function main() {
  log('\n🌱 Starting test data seeding...', 'blue');
  
  // 1. テストユーザーの作成
  log('\n👤 Creating test users...', 'yellow');
  for (const userData of TEST_USERS) {
    await createTestUser(userData);
  }

  // 2. テストファイルの作成
  log('\n📁 Creating test files...', 'yellow');
  await createTestFiles();

  // 3. ストレージバケットのセットアップ
  log('\n📦 Setting up storage buckets...', 'yellow');
  await setupStorageBuckets();

  log('\n✨ Test data seeding completed!', 'green');
  log('\nTest accounts:', 'blue');
  TEST_USERS.forEach(user => {
    log(`  - ${user.email} / ${user.password}`, 'reset');
  });
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  log(`\n❌ Unhandled error: ${error}`, 'red');
  process.exit(1);
});

// メイン処理の実行
main().catch((error) => {
  log(`\n❌ Fatal error: ${error}`, 'red');
  process.exit(1);
});
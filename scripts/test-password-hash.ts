import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 環境変数をロード
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service Roleキーを使用してクライアントを作成
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testPasswordVariations() {
  console.log('=========================================');
  console.log('パスワードバリエーションテスト');
  console.log('=========================================\n');

  const testPasswords = [
    'testpassword123',
    'TestPassword123',
    'TestPassword123!',
    'Test123!',
    'testpassword',
    'password123'
  ];

  for (const password of testPasswords) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: password,
      });

      if (error) {
        console.log(`❌ "${password}" - 失敗: ${error.message}`);
      } else {
        console.log(`✅ "${password}" - 成功!`);
        // ユーザーのメタデータも確認
        if (data.user) {
          console.log(`   User ID: ${data.user.id}`);
          console.log(`   Created: ${data.user.created_at}`);
        }
      }
    } catch (err) {
      console.error(`予期しないエラー (${password}):`, err);
    }
  }
}

// 実行
testPasswordVariations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
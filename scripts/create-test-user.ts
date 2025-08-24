import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const testUserEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
const testUserPassword = process.env.TEST_USER_PASSWORD || 'Test123';

async function createTestUser() {
  console.log('🔧 テストユーザー作成スクリプトを開始...');
  console.log(`📧 Email: ${testUserEmail}`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);

  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Try to sign in first to check if user exists
    console.log('📝 既存ユーザーとしてログインを試行中...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: testUserPassword,
    });
    
    if (signInData?.user) {
      console.log('✅ テストユーザーは既に存在し、ログインできます');
      console.log(`   User ID: ${signInData.user.id}`);
      console.log(`   Email: ${signInData.user.email}`);
      console.log(`   Created: ${signInData.user.created_at}`);
      return;
    }

    // If sign in failed, try to create new user
    console.log('📝 新しいテストユーザーを作成中...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testUserEmail,
      password: testUserPassword,
      options: {
        data: {
          email: testUserEmail,
          email_verified: true,
          phone_verified: false
        }
      }
    });

    if (signUpError) {
      console.error('❌ ユーザー作成エラー:', signUpError);
      
      // If user already exists but password is wrong, we can't fix it without admin API
      if (signUpError.message?.includes('already registered')) {
        console.log('⚠️  ユーザーは既に存在しますが、パスワードが異なる可能性があります');
        console.log('💡 Supabase Dashboardから手動でパスワードをリセットしてください');
      }
      process.exit(1);
    }

    if (signUpData?.user) {
      console.log('✅ テストユーザーを作成しました');
      console.log(`   User ID: ${signUpData.user.id}`);
      console.log(`   Email: ${signUpData.user.email}`);
      console.log(`   Created: ${signUpData.user.created_at}`);
      
      // Try to confirm email immediately (this may not work without admin access)
      console.log('📧 メール確認を試行中...');
      const { error: confirmError } = await supabase.auth.verifyOtp({
        email: testUserEmail,
        token: '000000', // This won't work, but we try
        type: 'email'
      }).catch(() => ({ error: 'Skip' }));
      
      if (!confirmError) {
        console.log('✅ メール確認済み');
      } else {
        console.log('⚠️  メール確認はスキップされました（開発環境では通常自動確認されます）');
      }
    }

  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  }
}

// Run the script
createTestUser().then(() => {
  console.log('✨ スクリプトが正常に完了しました');
  process.exit(0);
}).catch((error) => {
  console.error('❌ スクリプトエラー:', error);
  process.exit(1);
});
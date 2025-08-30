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

async function checkUsers() {
  console.log('🔍 Supabaseの既存ユーザーを確認中...\n');
  
  try {
    // すべてのユーザーを取得
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('エラー:', error);
      return;
    }
    
    if (!users || users.users.length === 0) {
      console.log('❌ ユーザーが存在しません');
      return;
    }
    
    console.log(`✅ ${users.users.length}人のユーザーが見つかりました:\n`);
    
    users.users.forEach((user, index) => {
      console.log(`ユーザー ${index + 1}:`);
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  🔑 ID: ${user.id}`);
      console.log(`  📅 作成日: ${new Date(user.created_at).toLocaleString('ja-JP')}`);
      console.log(`  ✅ メール確認: ${user.email_confirmed_at ? '済み' : '未確認'}`);
      console.log(`  🏷️ Role: ${user.user_metadata?.role || 'user'}`);
      console.log('');
    });
    
    // テストログインを試みる
    console.log('========================================');
    console.log('📝 テストログインを試行中...');
    console.log('========================================\n');
    
    // test@example.comでログインを試す（両方のパスワードで）
    const testPasswords = ['Test123!', 'testpassword123'];
    
    for (const password of testPasswords) {
      console.log(`🔐 test@example.com / ${password} でログイン試行...`);
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: password
      });
      
      if (loginError) {
        console.log(`  ❌ 失敗: ${loginError.message}`);
      } else if (data.user) {
        console.log(`  ✅ 成功！正しいパスワード: ${password}`);
        await supabase.auth.signOut();
        break;
      }
    }
    
  } catch (error) {
    console.error('予期しないエラー:', error);
  }
}

checkUsers().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
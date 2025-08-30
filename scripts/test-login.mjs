import { createClient } from '@supabase/supabase-js';

// Local Supabase credentials
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
  console.log('🔐 ログインテスト開始\n');
  
  const credentials = [
    { email: 'test@example.com', password: 'testpassword123', description: 'テストユーザー' },
    { email: 'admin@example.com', password: 'adminpassword123', description: '管理者ユーザー' }
  ];
  
  for (const cred of credentials) {
    console.log(`\n📧 ${cred.description}: ${cred.email}`);
    console.log(`🔑 パスワード: ${cred.password}`);
    console.log('ログイン試行中...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cred.email,
      password: cred.password
    });
    
    if (error) {
      console.log(`❌ ログイン失敗: ${error.message}`);
    } else if (data.user) {
      console.log(`✅ ログイン成功！`);
      console.log(`  - ユーザーID: ${data.user.id}`);
      console.log(`  - Email: ${data.user.email}`);
      console.log(`  - Role: ${data.user.user_metadata?.role || 'user'}`);
      console.log(`  - セッショントークン: ${data.session?.access_token.substring(0, 20)}...`);
      
      // ログアウト
      await supabase.auth.signOut();
      console.log(`  - ログアウト完了`);
    }
  }
  
  console.log('\n========================================');
  console.log('📝 テスト結果まとめ');
  console.log('========================================');
  console.log('\n✅ 使用可能なログイン情報:');
  console.log('  📧 Email: test@example.com');
  console.log('  🔑 Password: testpassword123');
  console.log('\n🌐 ログインページでテスト: http://localhost:3001/login');
}

testLogin().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
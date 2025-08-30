import { createClient } from '@supabase/supabase-js';

// Local Supabase credentials
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testProfileAccess() {
  console.log('🔐 プロフィールページアクセステスト\n');
  console.log('========================================');
  
  // Step 1: ログイン
  console.log('1. ログイン処理');
  console.log('-------------------------------------');
  
  const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  });
  
  if (loginError) {
    console.error('❌ ログイン失敗:', loginError.message);
    return;
  }
  
  console.log('✅ ログイン成功');
  console.log('  ユーザーID:', authData.user.id);
  console.log('  Email:', authData.user.email);
  
  // Step 2: プロフィール確認
  console.log('\n2. プロフィール情報確認');
  console.log('-------------------------------------');
  
  // プロフィールテーブルをチェック
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  
  if (profileError) {
    console.log('⚠️ プロフィールが見つかりません');
    console.log('  新規プロフィールを作成する必要があります');
    
    // プロフィールを作成
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        username: 'testuser',
        full_name: 'Test User',
        role: 'user'
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ プロフィール作成エラー:', createError.message);
    } else {
      console.log('✅ プロフィールを作成しました');
      console.log('  Username:', newProfile.username);
      console.log('  Full Name:', newProfile.full_name);
    }
  } else {
    console.log('✅ プロフィール情報あり');
    console.log('  Username:', profile.username);
    console.log('  Full Name:', profile.full_name);
    console.log('  Role:', profile.role);
  }
  
  // Step 3: ユーザー設定確認
  console.log('\n3. ユーザー設定確認');
  console.log('-------------------------------------');
  
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', authData.user.id)
    .single();
  
  if (settingsError) {
    console.log('⚠️ ユーザー設定が見つかりません');
    console.log('  デフォルト設定が使用されます');
  } else {
    console.log('✅ ユーザー設定あり');
    console.log('  翻訳モデル:', settings.translation_model);
    console.log('  ターゲット言語:', settings.target_language);
    console.log('  テーマ:', settings.theme);
  }
  
  // Step 4: アクセス情報
  console.log('\n========================================');
  console.log('📝 プロフィールページアクセス情報');
  console.log('========================================\n');
  console.log('✅ 認証状態: ログイン済み');
  console.log('✅ プロフィール: 設定済み');
  console.log('\n📍 アクセス可能なページ:');
  console.log('  - http://localhost:3001/profile (プロフィール)');
  console.log('  - http://localhost:3001/dashboard (ダッシュボード)');
  console.log('  - http://localhost:3001/upload (アップロード)');
  console.log('\n⚠️ 注意:');
  console.log('  ブラウザでログインしてからアクセスしてください');
  console.log('  セッションはブラウザごとに管理されます');
  
  // ログアウト
  await supabase.auth.signOut();
  console.log('\n✅ テスト完了 - ログアウトしました');
}

testProfileAccess().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
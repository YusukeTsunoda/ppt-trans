import { createClient } from '@supabase/supabase-js';

// ローカルSupabaseの接続情報
const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetTestUserPassword() {
  try {
    // ユーザーの検索
    const { data: users, error: searchError } = await supabase.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Failed to list users:', searchError);
      return;
    }

    const testUser = users.users.find(u => u.email === 'test@example.com');
    
    if (!testUser) {
      console.log('Test user not found, creating new one...');
      
      // テストユーザーの作成
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'test@example.com',
        password: 'testpassword123',
        email_confirm: true
      });

      if (authError) {
        console.error('Failed to create user:', authError);
        return;
      }
      
      console.log('✅ Test user created:', authData.user?.email);
      return;
    }

    // パスワードの更新
    const { data, error } = await supabase.auth.admin.updateUserById(
      testUser.id,
      { 
        password: 'testpassword123',
        email_confirm: true
      }
    );

    if (error) {
      console.error('Failed to update password:', error);
    } else {
      console.log('✅ Password updated for test@example.com');
      console.log('   Email:', data.user?.email);
      console.log('   ID:', data.user?.id);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

resetTestUserPassword();
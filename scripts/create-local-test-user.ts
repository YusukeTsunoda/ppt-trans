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

async function createTestUser() {
  try {
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

    // プロファイルの作成
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: authData.user.email,
          role: 'USER',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
      } else {
        console.log('✅ Profile created for test user');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

createTestUser();
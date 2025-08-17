import { createClient } from './supabase/client';

// 互換性のため両方エクスポート
export const supabase = createClient();

// 簡単な認証関数
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true, data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('Get user error:', error);
    return null;
  }
  
  return user;
}
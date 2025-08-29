import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import type { User } from '@supabase/supabase-js';

// リクエストスコープのSupabaseクライアント生成（React cache使用）
export const getRequestScopedSupabase = cache(async () => {
  const cookieStore = await cookies();
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component内でのcookie設定は無視
          }
        },
      },
    }
  );
});

// リクエストスコープのユーザー取得（React cache使用）
export const getRequestScopedUser = cache(async (): Promise<User | null> => {
  const supabase = await getRequestScopedSupabase();
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
});

// リクエストスコープのプロファイル取得（React cache使用）
export const getRequestScopedProfile = cache(async (userId?: string) => {
  const supabase = await getRequestScopedSupabase();
  
  // userIdが指定されない場合は現在のユーザーを取得
  const targetUserId = userId || (await getRequestScopedUser())?.id;
  
  if (!targetUserId) {
    return null;
  }
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();
    
    if (error) {
      console.error('Failed to get profile:', error);
      return null;
    }
    
    return profile;
  } catch (error) {
    console.error('Failed to get profile:', error);
    return null;
  }
});

// 統合された認証情報取得（React cache使用）
export const getAuthenticatedUser = cache(async () => {
  const user = await getRequestScopedUser();
  
  if (!user) {
    return null;
  }
  
  const profile = await getRequestScopedProfile(user.id);
  
  return {
    id: user.id,
    email: user.email,
    role: profile?.role?.toLowerCase() || 'user',
    username: profile?.username,
    full_name: profile?.full_name,
    created_at: user.created_at,
    updated_at: profile?.updated_at || user.updated_at,
  };
});

// 認証チェックヘルパー
export async function requireAuthentication() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

// 管理者権限チェックヘルパー
export async function requireAdminRole() {
  const user = await getAuthenticatedUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (user.role?.toLowerCase() !== 'admin') {
    throw new Error('Admin role required');
  }
  
  return user;
}

// セッション検証ヘルパー
export async function validateSession(): Promise<boolean> {
  const user = await getRequestScopedUser();
  return !!user;
}

// セッションリフレッシュヘルパー
export async function refreshSession() {
  const supabase = await getRequestScopedSupabase();
  
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();
    
    if (error || !session) {
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Failed to refresh session:', error);
    return null;
  }
}
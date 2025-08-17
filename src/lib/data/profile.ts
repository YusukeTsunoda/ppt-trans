import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export interface Profile {
  id: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  updated_at: string;
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    logger.error('Error fetching profile:', error);
    // プロフィールがない場合は空のプロフィールを返す
    return {
      id: userId,
      display_name: '',
      bio: '',
      avatar_url: '',
      updated_at: new Date().toISOString()
    };
  }
  
  return data;
}
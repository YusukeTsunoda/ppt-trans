import { createClient } from '@/lib/supabase/server';

export interface FileRecord {
  id: string;
  user_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  translation_result?: {
    translated_path?: string;
    slide_count?: number;
    error?: string;
  };
  created_at: string;
  updated_at: string;
}

export async function getUserFiles(): Promise<FileRecord[]> {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return [];
  }
  
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching files:', error);
    return [];
  }
  
  return data || [];
}
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';

export interface FileRecord {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  file_path: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  extracted_data?: {
    translated_path?: string;
    slide_count?: number;
    translation_completed_at?: string;
    error?: string;
    [key: string]: any;
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
    logger.error('Error fetching files:', error);
    return [];
  }
  
  return data || [];
}
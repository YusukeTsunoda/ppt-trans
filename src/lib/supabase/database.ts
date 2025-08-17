import { createClient } from '@/lib/supabase/client';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// データベース型定義
export interface UserSettings {
  id?: string;
  user_id: string;
  translation_model?: string;
  target_language?: string;
  batch_size?: number;
  auto_save?: boolean;
  theme?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FileRecord {
  id?: string;
  user_id: string;
  filename: string;
  original_name: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  status?: string;
  slide_count?: number;
  text_count?: number;
  translation_progress?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Translation {
  id?: string;
  file_id: string;
  original_text: string;
  translated_text?: string;
  slide_number?: number;
  element_index?: number;
  status?: string;
  model_used?: string;
  tokens_used?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityLog {
  id?: string;
  user_id: string;
  action: string;
  description?: string;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export interface UsageLimit {
  id?: string;
  user_id: string;
  monthly_file_limit?: number;
  monthly_translation_limit?: number;
  files_used?: number;
  translations_used?: number;
  reset_date?: string;
  created_at?: string;
  updated_at?: string;
}

// データベースヘルパー関数（クライアントサイド）
export const db = {
  // ユーザー設定
  userSettings: {
    async get(userId: string) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async upsert(settings: UserSettings) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(settings)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // ファイル管理
  files: {
    async list(userId: string) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },

    async get(fileId: string) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      if (error) throw error;
      return data;
    },

    async create(file: FileRecord) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('files')
        .insert(file)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async update(fileId: string, updates: Partial<FileRecord>) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('files')
        .update(updates)
        .eq('id', fileId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async delete(fileId: string) {
      const supabase = createClient();
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId);
      
      if (error) throw error;
    }
  },

  // 翻訳管理
  translations: {
    async listByFile(fileId: string) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('translations')
        .select('*')
        .eq('file_id', fileId)
        .order('slide_number', { ascending: true })
        .order('element_index', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },

    async create(translation: Translation) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('translations')
        .insert(translation)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async createBatch(translations: Translation[]) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('translations')
        .insert(translations)
        .select();
      
      if (error) throw error;
      return data || [];
    },

    async update(translationId: string, updates: Partial<Translation>) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('translations')
        .update(updates)
        .eq('id', translationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // アクティビティログ
  activityLogs: {
    async create(log: ActivityLog) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_logs')
        .insert(log)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async list(userId: string, limit = 50) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    }
  },

  // 使用制限
  usageLimits: {
    async get(userId: string) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('usage_limits')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },

    async increment(userId: string, field: 'files_used' | 'translations_used', amount = 1) {
      const supabase = createClient();
      
      // 現在の値を取得
      const current = await this.get(userId);
      
      if (!current) {
        // 新規作成
        const { data, error } = await supabase
          .from('usage_limits')
          .insert({
            user_id: userId,
            [field]: amount
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
      
      // 更新
      const { data, error } = await supabase
        .from('usage_limits')
        .update({
          [field]: (current[field] || 0) + amount
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};

// サーバーサイド用のヘルパー関数
export const serverDb = {
  async getUserSettings(userId: string) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async createFile(file: FileRecord) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('files')
      .insert(file)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async logActivity(log: ActivityLog) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('activity_logs')
      .insert(log)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};
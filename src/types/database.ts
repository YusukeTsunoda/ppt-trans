/**
 * Supabase Database Types
 * 
 * このファイルは本来 `supabase gen types` で自動生成されるべきですが、
 * 現在のスキーマに基づいて手動で定義しています。
 * 
 * 生成コマンド: npx supabase gen types typescript --project-id [PROJECT_ID]
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          role: 'USER' | 'ADMIN'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: 'USER' | 'ADMIN'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          role?: 'USER' | 'ADMIN'
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          user_id: string
          original_file_url: string
          original_file_name: string
          file_size: number
          mime_type: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          slide_count: number | null
          processing_result: Json | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          original_file_url: string
          original_file_name: string
          file_size: number
          mime_type: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          slide_count?: number | null
          processing_result?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          original_file_url?: string
          original_file_name?: string
          file_size?: number
          mime_type?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          slide_count?: number | null
          processing_result?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      translations: {
        Row: {
          id: string
          file_id: string
          user_id: string
          source_language: string
          target_language: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          translated_data: Json | null
          translated_file_url: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          file_id: string
          user_id: string
          source_language?: string
          target_language?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          translated_data?: Json | null
          translated_file_url?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          file_id?: string
          user_id?: string
          source_language?: string
          target_language?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          translated_data?: Json | null
          translated_file_url?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          description: string | null
          metadata: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          description?: string | null
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          description?: string | null
          metadata?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          default_source_language: string
          default_target_language: string
          translation_style: string
          auto_save: boolean
          email_notifications: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          default_source_language?: string
          default_target_language?: string
          translation_style?: string
          auto_save?: boolean
          email_notifications?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          default_source_language?: string
          default_target_language?: string
          translation_style?: string
          auto_save?: boolean
          email_notifications?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'USER' | 'ADMIN'
      file_status: 'pending' | 'processing' | 'completed' | 'failed'
      translation_status: 'pending' | 'processing' | 'completed' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Utility types for common queries
export type Profile = Tables<'profiles'>
export type File = Tables<'files'>
export type Translation = Tables<'translations'>
export type ActivityLog = Tables<'activity_logs'>
export type UserSettings = Tables<'user_settings'>
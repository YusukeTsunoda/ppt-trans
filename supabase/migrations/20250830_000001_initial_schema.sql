-- =====================================================================
-- PowerPoint Translation Tool - Complete Database Schema
-- Date: 2025-08-30
-- Version: 1.0.0
-- Description: Complete initial database setup with all tables, 
--              indexes, RLS policies, functions, and triggers
-- =====================================================================

-- =====================================================================
-- 1. EXTENSIONS
-- =====================================================================
-- Enable UUID extension for generating unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_cron for scheduled jobs (optional - uncomment if available)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================================
-- 2. CORE APPLICATION TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles table (extends auth.users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ---------------------------------------------------------------------
-- User settings table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    translation_model TEXT DEFAULT 'claude-3-haiku-20240307',
    target_language TEXT DEFAULT 'Japanese',
    batch_size INTEGER DEFAULT 5 CHECK (batch_size > 0 AND batch_size <= 50),
    auto_save BOOLEAN DEFAULT true,
    theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- ---------------------------------------------------------------------
-- Files table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER CHECK (file_size >= 0),
    mime_type TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    slide_count INTEGER DEFAULT 0 CHECK (slide_count >= 0),
    text_count INTEGER DEFAULT 0 CHECK (text_count >= 0),
    translation_progress DECIMAL(5,2) DEFAULT 0 CHECK (translation_progress >= 0 AND translation_progress <= 100),
    error_message TEXT,
    extracted_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON public.files(status);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);

-- ---------------------------------------------------------------------
-- Translations table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.translations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    file_id UUID REFERENCES public.files(id) ON DELETE CASCADE NOT NULL,
    original_text TEXT NOT NULL,
    translated_text TEXT,
    slide_number INTEGER CHECK (slide_number >= 0),
    element_index INTEGER CHECK (element_index >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    model_used TEXT,
    tokens_used INTEGER CHECK (tokens_used >= 0),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_translations_file_id ON public.translations(file_id);
CREATE INDEX IF NOT EXISTS idx_translations_status ON public.translations(status);

-- ---------------------------------------------------------------------
-- Activity logs table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- ---------------------------------------------------------------------
-- API usage tracking table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    api_name TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost DECIMAL(10,6) DEFAULT 0,
    request_data JSONB,
    response_data JSONB,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);

-- ---------------------------------------------------------------------
-- Error logs table (for monitoring)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_code TEXT,
    stack_trace TEXT,
    context JSONB DEFAULT '{}',
    severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);

-- =====================================================================
-- 3. VIEWS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Users with statistics view
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.users_with_stats AS
SELECT 
    p.id,
    au.email,
    p.full_name as name,
    p.role,
    p.created_at,
    au.last_sign_in_at,
    CASE 
        WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN true
        ELSE false
    END as is_active,
    COUNT(DISTINCT f.id) as files_count,
    COUNT(DISTINCT t.id) as translations_count
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
LEFT JOIN files f ON f.user_id = p.id
LEFT JOIN translations t ON t.file_id = f.id
GROUP BY p.id, au.email, p.full_name, p.role, p.created_at, au.last_sign_in_at;

-- =====================================================================
-- 4. FUNCTIONS
-- =====================================================================

-- ---------------------------------------------------------------------
-- Function: handle_new_user
-- Automatically creates a profile when a new user signs up
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    
    -- Also create default user settings
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Function: update_updated_at_column
-- Updates the updated_at timestamp when a row is modified
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- Function: get_admin_stats
-- Returns overall system statistics for admin dashboard
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    SELECT json_build_object(
        'total_users', (SELECT COUNT(*) FROM profiles),
        'active_users', (
            SELECT COUNT(*) FROM auth.users 
            WHERE last_sign_in_at > NOW() - INTERVAL '30 days'
        ),
        'total_files', (SELECT COUNT(*) FROM files),
        'total_translations', (SELECT COUNT(*) FROM translations),
        'storage_used', COALESCE((SELECT SUM(file_size) FROM files), 0),
        'active_subscriptions', 0 -- Placeholder for future subscription system
    ) INTO result;

    RETURN result;
END;
$$;

-- ---------------------------------------------------------------------
-- Function: get_recent_activities
-- Returns recent system activities with user information
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_recent_activities(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    action TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    user_email TEXT,
    user_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if the calling user is an admin
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    RETURN QUERY
    SELECT 
        al.id,
        al.user_id,
        al.action,
        al.description,
        al.metadata,
        al.created_at,
        au.email as user_email,
        p.full_name as user_name
    FROM activity_logs al
    LEFT JOIN auth.users au ON al.user_id = au.id
    LEFT JOIN profiles p ON al.user_id = p.id
    ORDER BY al.created_at DESC
    LIMIT limit_count;
END;
$$;

-- ---------------------------------------------------------------------
-- Function: log_activity
-- Helper function to log user activities
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action TEXT,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activity_logs (
        user_id,
        action,
        description,
        metadata,
        created_at
    ) VALUES (
        auth.uid(),
        p_action,
        p_description,
        p_metadata,
        NOW()
    ) RETURNING id INTO activity_id;

    RETURN activity_id;
END;
$$;

-- =====================================================================
-- 5. TRIGGERS
-- =====================================================================

-- Trigger: Create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers: Update updated_at timestamp
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_translations_updated_at ON public.translations;
CREATE TRIGGER update_translations_updated_at
    BEFORE UPDATE ON public.translations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: Log file uploads
CREATE OR REPLACE FUNCTION public.log_file_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM log_activity(
        'upload',
        'ファイルをアップロードしました: ' || NEW.original_name,
        jsonb_build_object(
            'file_id', NEW.id,
            'filename', NEW.original_name,
            'file_size', NEW.file_size
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_file_upload ON files;
CREATE TRIGGER trigger_log_file_upload
    AFTER INSERT ON files
    FOR EACH ROW
    EXECUTE FUNCTION log_file_upload();

-- =====================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Profiles policies
-- ---------------------------------------------------------------------
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ---------------------------------------------------------------------
-- User settings policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own settings"
    ON public.user_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON public.user_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
    ON public.user_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Files policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own files"
    ON public.files FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
    ON public.files FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
    ON public.files FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
    ON public.files FOR DELETE
    USING (auth.uid() = user_id);

-- Admin can view all files
CREATE POLICY "Admins can view all files"
    ON public.files FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ---------------------------------------------------------------------
-- Translations policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view translations for own files"
    ON public.translations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM files
            WHERE files.id = translations.file_id
            AND files.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert translations for own files"
    ON public.translations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM files
            WHERE files.id = file_id
            AND files.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update translations for own files"
    ON public.translations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM files
            WHERE files.id = translations.file_id
            AND files.user_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------
-- Activity logs policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own activities"
    ON public.activity_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all activities
CREATE POLICY "Admins can view all activities"
    ON public.activity_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ---------------------------------------------------------------------
-- API usage policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own API usage"
    ON public.api_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API usage"
    ON public.api_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all API usage
CREATE POLICY "Admins can view all API usage"
    ON public.api_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ---------------------------------------------------------------------
-- Error logs policies
-- ---------------------------------------------------------------------
CREATE POLICY "Users can view own errors"
    ON public.error_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert error logs"
    ON public.error_logs FOR INSERT
    WITH CHECK (true);

-- Admins can view and update all errors
CREATE POLICY "Admins can view all errors"
    ON public.error_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can update all errors"
    ON public.error_logs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- =====================================================================
-- 7. STORAGE BUCKETS
-- =====================================================================

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'uploads',
    'uploads',
    false,
    52428800, -- 50MB
    ARRAY['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload files to uploads bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own files in uploads bucket"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own files from uploads bucket"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'uploads' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- =====================================================================
-- 8. GRANT PERMISSIONS
-- =====================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON public.users_with_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_activities(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, jsonb) TO authenticated;

-- Grant usage on all sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- =====================================================================
-- End of migration
-- =====================================================================
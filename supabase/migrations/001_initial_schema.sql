-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  translation_model TEXT DEFAULT 'claude-3-5-haiku-20241022',
  source_language TEXT DEFAULT 'auto',
  target_language TEXT DEFAULT 'ja',
  batch_size INTEGER DEFAULT 5,
  auto_save BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create files table (統合版)
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  translated_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  source_language TEXT DEFAULT 'auto',
  target_language TEXT DEFAULT 'ja',
  slide_count INTEGER DEFAULT 0,
  text_count INTEGER DEFAULT 0,
  translation_progress DECIMAL(5,2) DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create translations table
CREATE TABLE IF NOT EXISTS public.translations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  translated_text TEXT,
  slide_number INTEGER,
  element_index INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create usage_limits table
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  monthly_file_limit INTEGER DEFAULT 10,
  monthly_translation_limit INTEGER DEFAULT 1000,
  files_used INTEGER DEFAULT 0,
  translations_used INTEGER DEFAULT 0,
  reset_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create test_connection table for health checks
CREATE TABLE IF NOT EXISTS public.test_connection (
  id INTEGER PRIMARY KEY DEFAULT 1,
  status TEXT DEFAULT 'ok',
  last_check TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial test record
INSERT INTO public.test_connection (id, status) 
VALUES (1, 'ok') 
ON CONFLICT (id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON public.files(status);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_file_id ON public.translations(file_id);
CREATE INDEX IF NOT EXISTS idx_translations_status ON public.translations(status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_limits_updated_at BEFORE UPDATE ON public.usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Profiles: Users can view all profiles but only edit their own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User settings: Users can only view/edit their own settings
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Files: Users can only manage their own files
CREATE POLICY "Users can view own files" ON public.files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON public.files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON public.files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON public.files
  FOR DELETE USING (auth.uid() = user_id);

-- Translations: Users can only manage translations for their files
CREATE POLICY "Users can view own translations" ON public.translations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = translations.file_id
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own translations" ON public.translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = translations.file_id
      AND files.user_id = auth.uid()
    )
  );

-- Activity logs: Users can only view their own logs
CREATE POLICY "Users can view own activity" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage limits: Users can only view their own limits
CREATE POLICY "Users can view own limits" ON public.usage_limits
  FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_settings TO authenticated;
GRANT ALL ON public.files TO authenticated;
GRANT ALL ON public.translations TO authenticated;
GRANT ALL ON public.activity_logs TO authenticated;
GRANT ALL ON public.usage_limits TO authenticated;
GRANT ALL ON public.test_connection TO authenticated;

-- Grant permissions to service role (for admin operations)
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.files TO service_role;
GRANT ALL ON public.translations TO service_role;
GRANT ALL ON public.activity_logs TO service_role;
GRANT ALL ON public.usage_limits TO service_role;
GRANT ALL ON public.test_connection TO service_role;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  
  -- 新規ユーザー用の設定も自動作成
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  -- 使用制限の初期設定も作成
  INSERT INTO public.usage_limits (user_id, reset_date)
  VALUES (NEW.id, DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
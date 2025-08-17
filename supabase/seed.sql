-- Test users for E2E testing
-- Using a simple approach without profiles table dependencies

-- Clear existing test users
DELETE FROM auth.users WHERE email IN ('test@example.com', 'admin@example.com');

-- Note: These users will be created via Supabase Admin API or UI
-- since direct password insertion requires specific bcrypt format
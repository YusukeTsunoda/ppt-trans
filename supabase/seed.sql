-- =====================================================================
-- PowerPoint Translation Tool - Seed Data
-- Date: 2025-08-30
-- Version: 1.0.0
-- Description: Development seed data with test and admin users
-- =====================================================================

-- Note: Since we cannot directly insert bcrypt passwords in SQL,
-- we'll create these users via a separate script using Supabase Admin API
-- This file serves as documentation for the intended seed data

-- =====================================================================
-- 1. INTENDED TEST USERS (created via Admin API)
-- =====================================================================
-- Test User:
--   Email: test@example.com
--   Password: testpassword123
--   Role: user

-- Admin User:
--   Email: admin@example.com
--   Password: adminpassword123
--   Role: admin

-- =====================================================================
-- 2. SAMPLE DATA FOR TESTING (can be inserted directly)
-- =====================================================================

-- Sample translation history (requires user IDs to be created first)
-- These will be inserted after users are created via the setup script

-- Sample user settings (requires user IDs to be created first)
-- These will be inserted after users are created via the setup script

-- =====================================================================
-- 3. STORAGE BUCKETS
-- =====================================================================
-- Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES 
    ('pptx-files', 'pptx-files', false, NOW(), NOW()),
    ('translated-files', 'translated-files', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. PLACEHOLDER FOR FUTURE SEED DATA
-- =====================================================================
-- Additional seed data can be added here as the application grows
#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteExistingUser() {
  console.log('🗑️ Deleting existing test user...');
  
  const { error } = await supabase.auth.admin.deleteUser('11111111-1111-1111-1111-111111111111');
  
  if (error && error.message !== 'User not found') {
    console.error('Error deleting user:', error);
    return false;
  }
  
  console.log('✅ User deleted or not found');
  return true;
}

async function createTestUser() {
  console.log('👤 Creating test user with Admin API...');
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: {
      name: 'Test User'
    }
  });

  if (error) {
    console.error('❌ Failed to create user:', error);
    return false;
  }

  console.log('✅ User created successfully');
  console.log('User ID:', data.user?.id);
  console.log('Email:', data.user?.email);
  return true;
}

async function testLogin() {
  console.log('🔐 Testing login with new user...');
  
  // Use anon key for login test
  const anonClient = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');
  
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }

  console.log('✅ Login successful!');
  console.log('User:', data.user?.email);
  console.log('Session:', data.session ? 'Created' : 'Not created');
  return true;
}

async function main() {
  await deleteExistingUser();
  await createTestUser();
  await testLogin();
}

main().catch(console.error);
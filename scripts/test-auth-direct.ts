#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testLogin() {
  console.log('🔐 Testing login with test@example.com / testpassword123');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
    console.error('Error details:', error);
    return false;
  }

  console.log('✅ Login successful!');
  console.log('User:', data.user?.email);
  console.log('Session:', data.session ? 'Created' : 'Not created');
  return true;
}

async function main() {
  await testLogin();
}

main().catch(console.error);
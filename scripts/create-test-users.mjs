import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUsers() {
  try {
    // Delete existing users first
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    
    for (const user of existingUsers?.users || []) {
      if (user.email === 'admin@example.com' || user.email === 'user1@example.com') {
        await supabase.auth.admin.deleteUser(user.id);
        console.log(`Deleted existing user: ${user.email}`);
      }
    }

    // Create admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@example.com',
      password: 'Admin123!',
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    });

    if (adminError) {
      console.error('Error creating admin user:', adminError);
    } else {
      console.log('Admin user created:', adminUser.user?.email);
    }

    // Create regular user
    const { data: testUser, error: userError } = await supabase.auth.admin.createUser({
      email: 'user1@example.com',
      password: 'User123!',
      email_confirm: true,
      user_metadata: {
        role: 'user'
      }
    });

    if (userError) {
      console.error('Error creating test user:', userError);
    } else {
      console.log('Test user created:', testUser.user?.email);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

createTestUsers();
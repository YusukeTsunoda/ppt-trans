const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

// Use service role key for admin operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedUsers() {
  try {
    // Create admin user
    const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@example.com',
      password: 'Admin123!',
      email_confirm: true,
      user_metadata: {
        role: 'ADMIN'
      }
    });

    if (adminError) {
      if (adminError.message?.includes('already been registered')) {
        console.log('Admin user already exists');
        
        // Update existing user to have admin role
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const existingAdmin = users?.users?.find(u => u.email === 'admin@example.com');
        if (existingAdmin) {
          await supabaseAdmin.auth.admin.updateUserById(existingAdmin.id, {
            user_metadata: { role: 'ADMIN' }
          });
          console.log('Updated admin user role');
        }
      } else {
        console.error('Error creating admin user:', adminError);
      }
    } else {
      console.log('Admin user created successfully:', adminUser.user?.email);
    }

    // Create regular test user
    const { data: testUser, error: testError } = await supabaseAdmin.auth.admin.createUser({
      email: 'user1@example.com',
      password: 'User123!',
      email_confirm: true,
      user_metadata: {
        role: 'USER'
      }
    });

    if (testError) {
      if (testError.message?.includes('already been registered')) {
        console.log('Test user already exists');
      } else {
        console.error('Error creating test user:', testError);
      }
    } else {
      console.log('Test user created successfully:', testUser.user?.email);
    }

  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    process.exit(0);
  }
}

seedUsers();
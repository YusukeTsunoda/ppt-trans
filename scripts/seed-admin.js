const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAdmin() {
  try {
    // Create admin user with hashed password
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .upsert({
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (userError) {
      console.error('Error creating admin user:', userError);
      return;
    }

    console.log('Admin user created successfully:', user.email);

    // Also create a regular test user
    const hashedUserPassword = await bcrypt.hash('User123!', 10);
    
    const { data: testUser, error: testUserError } = await supabase
      .from('profiles')
      .upsert({
        email: 'user1@example.com',
        password: hashedUserPassword,
        role: 'USER',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (testUserError) {
      console.error('Error creating test user:', testUserError);
      return;
    }

    console.log('Test user created successfully:', testUser.email);

  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    process.exit(0);
  }
}

seedAdmin();
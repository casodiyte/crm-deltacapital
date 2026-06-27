import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kzemdiggdpxfceiecbat.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6ZW1kaWdnZHB4ZmNlaWVjYmF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI4NjI0NCwiZXhwIjoyMDk2ODYyMjQ0fQ.XS6MAl0X4W_M8A3Q8K2zw2PwjEfelwj8KH8xKZXCRLw';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function diagnose() {
  // Check profiles table
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*').limit(5);
  console.log('Profiles:', JSON.stringify(profiles, null, 2), profError?.message);

  // Check sales table
  const { data: sales, error: salesError } = await supabase.from('sales').select('*').limit(5);
  console.log('Sales:', JSON.stringify(sales, null, 2), salesError?.message);

  // Try creating a test user to see the exact DB error
  console.log('\nAttempting test user creation...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test.delta.diag2025@gmail.com',
    password: 'Qwerty123456*',
    email_confirm: true,
  });
  console.log('Result:', data?.user?.id ?? 'no user', error?.message ?? 'no error');
  
  // Clean up test user if created
  if (data?.user?.id) {
    await supabase.auth.admin.deleteUser(data.user.id);
    console.log('Test user cleaned up');
  }
}

diagnose();

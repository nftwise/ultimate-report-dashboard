require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndFixUsers() {
  // Get all client users without client_id
  const { data: usersWithoutClient, error } = await supabase
    .from('users')
    .select('id, email, role, client_id')
    .eq('role', 'client')
    .is('client_id', null);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('=== Client Users WITHOUT client_id ===');
  if (usersWithoutClient.length === 0) {
    console.log('None! All client users are properly linked.');
    return;
  }

  usersWithoutClient.forEach(u => console.log(' -', u.email));
  console.log('');
  console.log('Total:', usersWithoutClient.length, 'users need fixing');

  // Get all clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, slug, name, contact_email');

  console.log('');
  console.log('=== Attempting to fix... ===');

  let fixed = 0;
  let notFixed = [];

  // Try to match and fix
  for (const user of usersWithoutClient) {
    // Find matching client by contact_email
    const matchingClient = clients.find(c => c.contact_email === user.email);

    if (matchingClient) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ client_id: matchingClient.id })
        .eq('id', user.id);

      if (updateError) {
        console.log('❌ Error fixing', user.email, ':', updateError.message);
        notFixed.push(user.email);
      } else {
        console.log('✅ Fixed:', user.email, '->', matchingClient.slug);
        fixed++;
      }
    } else {
      notFixed.push(user.email);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log('Fixed:', fixed);
  console.log('Not fixed:', notFixed.length);

  if (notFixed.length > 0) {
    console.log('');
    console.log('Users that need manual fixing:');
    notFixed.forEach(email => console.log(' -', email));
  }
}

checkAndFixUsers();

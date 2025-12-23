import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as bcrypt from 'bcryptjs'

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seedUsers() {
  console.log('🌱 Seeding users...\n')

  // First, let's check what clients exist
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, slug, contact_email')
    .limit(10)

  console.log('Existing clients:', clients)

  if (clientsError) {
    console.error('Error fetching clients:', clientsError.message)
  }

  // Check if users table exists and what's in it
  const { data: existingUsers, error: usersError } = await supabase
    .from('users')
    .select('*')

  console.log('Existing users:', existingUsers)

  if (usersError) {
    console.error('Error fetching users:', usersError.message)
  }

  // Create admin user
  const adminPassword = 'Admin123!@#'
  const adminHash = await bcrypt.hash(adminPassword, 10)

  const { data: adminUser, error: adminError } = await supabase
    .from('users')
    .upsert({
      email: 'admin@yourdomain.com',
      password_hash: adminHash,
      role: 'admin',
      client_id: null,
      is_active: true
    }, {
      onConflict: 'email'
    })
    .select()

  if (adminError) {
    console.error('❌ Error creating admin user:', adminError.message)
  } else {
    console.log('✅ Admin user created/updated')
    console.log('   📧 Email: admin@yourdomain.com')
    console.log('   🔑 Password: Admin123!@#')
  }

  // Find CorePosture client
  const { data: corePosture } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', '%coreposture%')
    .single()

  // Create client user for tyler@coreposturechiropractic.com
  const clientPassword = 'TempPassword456'
  const clientHash = await bcrypt.hash(clientPassword, 10)

  const { data: clientUser, error: clientError } = await supabase
    .from('users')
    .upsert({
      email: 'tyler@coreposturechiropractic.com',
      password_hash: clientHash,
      role: 'client',
      client_id: corePosture?.id || null,
      is_active: true
    }, {
      onConflict: 'email'
    })
    .select()

  if (clientError) {
    console.error('❌ Error creating client user:', clientError.message)
  } else {
    console.log('✅ Client user created/updated')
    console.log('   📧 Email: tyler@coreposturechiropractic.com')
    console.log('   🔑 Password: TempPassword456')
    console.log('   🏢 Client ID:', corePosture?.id || 'No client found')
  }

  console.log('\n✅ Seeding complete!')
}

// Run the script
seedUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })

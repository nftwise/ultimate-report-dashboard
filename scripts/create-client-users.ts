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

async function createUsersForClients() {
  console.log('📋 Fetching all active clients...\n')

  // Get all active clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, slug, contact_email')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError.message)
    process.exit(1)
  }

  console.log(`Found ${clients?.length || 0} active clients\n`)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const client of clients || []) {
    try {
      // Check if user already exists for this client
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('client_id', client.id)
        .single()

      if (existingUser) {
        console.log(`⏭️  ${client.name} - User already exists (${existingUser.email})`)
        skipped++
        continue
      }

      // Generate a simple password (clients should change this)
      const tempPassword = `Welcome${Math.random().toString(36).slice(2, 8)}!`
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      // Create user account
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email: client.contact_email,
          password_hash: hashedPassword,
          role: 'client',
          client_id: client.id,
          is_active: true
        })
        .select()
        .single()

      if (userError) {
        console.error(`❌ Error creating user for ${client.name}:`, userError.message)
        errors++
        continue
      }

      console.log(`✅ ${client.name}`)
      console.log(`   📧 Email: ${client.contact_email}`)
      console.log(`   🔑 Password: ${tempPassword}`)
      console.log(`   🔗 Login: http://localhost:3000/login\n`)

      created++

    } catch (error: any) {
      console.error(`❌ Error processing ${client.name}:`, error.message)
      errors++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`✅ Created: ${created}`)
  console.log(`⏭️  Skipped (already exists): ${skipped}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📋 Total: ${clients?.length || 0}`)
  console.log('='.repeat(60))
  console.log('\n💡 TIP: Save these credentials and share them with your clients!')
  console.log('🔒 Clients should change their passwords after first login.\n')
}

// Run the script
createUsersForClients()
  .then(() => {
    console.log('✅ Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })

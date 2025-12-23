import { createClient } from '@supabase/supabase-js'
import * as bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateClients() {
  console.log('🚀 Starting client migration to Supabase...\n')

  // Read clients.json
  const clientsPath = path.join(process.cwd(), 'src', 'data', 'clients.json')
  const clientsData = JSON.parse(fs.readFileSync(clientsPath, 'utf-8'))
  const clients = clientsData.clients

  console.log(`📊 Found ${clients.length} clients to migrate\n`)

  let successCount = 0
  let errorCount = 0

  for (const client of clients) {
    try {
      console.log(`Processing: ${client.companyName} (${client.id})...`)

      // 1. Insert client
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: client.companyName,
          slug: client.id,
          industry: 'chiropractic', // default for now
          contact_name: client.owner,
          contact_email: client.email,
          plan_type: 'standard',
          is_active: true
        })
        .select()
        .single()

      if (clientError) throw clientError

      console.log(`  ✅ Client created with ID: ${newClient.id}`)

      // 2. Insert service configs
      const { error: configError } = await supabase
        .from('service_configs')
        .insert({
          client_id: newClient.id,
          ga_property_id: client.googleAnalyticsPropertyId || null,
          gads_customer_id: client.googleAdsCustomerId || null,
          gads_manager_account_id: client.googleAdsMccId || null,
          gbp_location_id: client.gbpLocationId || null,
          callrail_account_id: client.callrailAccountId || null,
          gsc_site_url: client.searchConsoleSiteUrl || null
        })

      if (configError) throw configError

      console.log(`  ✅ Service configs saved`)

      // 3. Create user login
      const hashedPassword = await bcrypt.hash(client.password, 10)

      const { error: userError } = await supabase
        .from('users')
        .insert({
          email: client.email,
          password_hash: hashedPassword,
          role: 'client',
          client_id: newClient.id,
          is_active: true
        })

      if (userError) throw userError

      console.log(`  ✅ User account created: ${client.email}`)
      console.log(`  🔑 Password: ${client.password}\n`)

      successCount++
    } catch (error: any) {
      console.error(`  ❌ Error migrating ${client.companyName}:`, error.message)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`✅ Migration complete!`)
  console.log(`   Success: ${successCount}`)
  console.log(`   Errors: ${errorCount}`)
  console.log('='.repeat(50))

  // Create admin user
  console.log('\n🔐 Creating admin user...')
  try {
    const adminPassword = 'Admin123!@#'
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 10)

    const { error: adminError } = await supabase
      .from('users')
      .insert({
        email: 'admin@yourdomain.com',
        password_hash: hashedAdminPassword,
        role: 'admin',
        client_id: null,
        is_active: true
      })

    if (adminError && !adminError.message.includes('duplicate')) {
      throw adminError
    }

    console.log('✅ Admin user created!')
    console.log(`   Email: admin@yourdomain.com`)
    console.log(`   Password: ${adminPassword}`)
  } catch (error: any) {
    if (error.message.includes('duplicate')) {
      console.log('ℹ️  Admin user already exists')
    } else {
      console.error('❌ Error creating admin:', error.message)
    }
  }

  console.log('\n✨ All done! You can now log in to your dashboard.\n')
}

// Run migration
migrateClients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

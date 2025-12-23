import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function removeTestClients() {
  console.log('🗑️  Removing test clients with "client-###" pattern...\n')
  console.log('='.repeat(80))

  // Step 1: Find all test clients with pattern "client-" followed by numbers
  console.log('\n📋 Step 1: Finding test clients...')

  const { data: allClients, error: fetchError } = await supabase
    .from('clients')
    .select('id, slug, name, contact_email')
    .order('slug', { ascending: true })

  if (fetchError) {
    console.error('❌ Error fetching clients:', fetchError.message)
    return
  }

  // Filter for clients matching pattern: client-001, client-002, etc.
  const testClients = allClients?.filter(client => {
    return /^client-\d+$/.test(client.slug)
  }) || []

  if (testClients.length === 0) {
    console.log('✅ No test clients found with "client-###" pattern.')
    return
  }

  console.log(`\n⚠️  Found ${testClients.length} test clients to delete:\n`)
  testClients.forEach((client, index) => {
    console.log(`${index + 1}. ${client.slug} - ${client.name} (${client.contact_email})`)
  })

  console.log('\n⚠️  WARNING: This will permanently delete these clients and all related data!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('🗑️  Deleting test clients...\n')

  // Step 2: Delete each test client
  let deletedCount = 0
  let errorCount = 0

  for (const client of testClients) {
    console.log(`Deleting ${client.slug}...`)

    // Delete from service_configs first (foreign key constraint)
    const { error: configError } = await supabase
      .from('service_configs')
      .delete()
      .eq('client_id', client.slug)

    if (configError) {
      console.log(`   ⚠️  Could not delete service_configs: ${configError.message}`)
    } else {
      console.log(`   ✓ Deleted service_configs`)
    }

    // Delete the client
    const { error: clientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)

    if (clientError) {
      console.log(`   ❌ Error deleting client: ${clientError.message}`)
      errorCount++
    } else {
      console.log(`   ✅ Deleted client successfully`)
      deletedCount++
    }
    console.log('')
  }

  console.log('='.repeat(80))
  console.log(`\n📊 Results:`)
  console.log(`   Deleted: ${deletedCount} clients`)
  console.log(`   Errors: ${errorCount} clients`)

  // Step 3: Show remaining clients
  console.log('\n📋 Remaining active clients:\n')

  const { data: remainingClients } = await supabase
    .from('clients')
    .select('slug, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (remainingClients && remainingClients.length > 0) {
    console.log(`Total: ${remainingClients.length} clients\n`)
    remainingClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.slug} - ${client.name}`)
    })
  }

  console.log('\n✅ Cleanup complete!\n')
}

removeTestClients()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })

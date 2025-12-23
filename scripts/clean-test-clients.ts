import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function listAllClients() {
  console.log('📋 Fetching all clients from database...\n')

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, slug, name, contact_email, is_active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching clients:', error.message)
    return []
  }

  if (!clients || clients.length === 0) {
    console.log('No clients found in database.')
    return []
  }

  console.log(`Found ${clients.length} clients:\n`)
  clients.forEach((client, index) => {
    console.log(`${index + 1}. Slug: ${client.slug}`)
    console.log(`   ID: ${client.id}`)
    console.log(`   Name: ${client.name}`)
    console.log(`   Email: ${client.contact_email}`)
    console.log(`   Active: ${client.is_active ? '✓' : '✗'}`)
    console.log(`   Created: ${new Date(client.created_at).toLocaleString()}`)
    console.log('')
  })

  return clients
}

async function deleteTestClients() {
  const clients = await listAllClients()

  if (clients.length === 0) {
    return
  }

  console.log('\n🗑️  Identifying test clients to delete...\n')

  // Define test client patterns
  const testPatterns = [
    /test/i,           // Contains "test"
    /demo/i,           // Contains "demo"
    /example/i,        // Contains "example"
    /sample/i,         // Contains "sample"
    /@test\./i,        // Email with @test.
    /@example\./i,     // Email with @example.
    /temp/i,           // Contains "temp"
  ]

  const testClients = clients.filter(client => {
    const email = client.contact_email || ''
    const name = client.name || ''
    const slug = client.slug || ''

    return testPatterns.some(pattern =>
      pattern.test(email) || pattern.test(name) || pattern.test(slug)
    )
  })

  if (testClients.length === 0) {
    console.log('✅ No test clients found. All clients appear to be real.')
    return
  }

  console.log(`Found ${testClients.length} test client(s) to delete:\n`)
  testClients.forEach((client, index) => {
    console.log(`${index + 1}. ${client.slug} - ${client.contact_email} (${client.name})`)
  })

  console.log('\n⚠️  WARNING: This will permanently delete these clients and all related data!')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('🗑️  Deleting test clients...\n')

  for (const client of testClients) {
    console.log(`Deleting: ${client.contact_email}...`)

    // Delete from service_configs first (foreign key constraint)
    const { error: configError } = await supabase
      .from('service_configs')
      .delete()
      .eq('client_id', client.id)

    if (configError) {
      console.log(`  ⚠️  Could not delete service_configs: ${configError.message}`)
    } else {
      console.log(`  ✓ Deleted service_configs`)
    }

    // Delete the client
    const { error: clientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id)

    if (clientError) {
      console.log(`  ❌ Error deleting client: ${clientError.message}`)
    } else {
      console.log(`  ✅ Deleted client successfully`)
    }
    console.log('')
  }

  console.log('✅ Cleanup complete!\n')

  // Show remaining clients
  console.log('📋 Remaining clients:\n')
  await listAllClients()
}

// Main execution
console.log('🧹 Test Client Cleanup Tool\n')
console.log('=' .repeat(60))

deleteTestClients()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
  })

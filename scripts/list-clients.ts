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

async function listClients() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      slug,
      contact_email,
      industry,
      is_active,
      service_configs (
        ga_property_id,
        gads_customer_id,
        gbp_location_id,
        gsc_site_url
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`\n📊 Total Active Clients: ${clients?.length || 0}\n`)
  console.log('='.repeat(80))

  clients?.forEach((client: any, index: number) => {
    const config = Array.isArray(client.service_configs)
      ? client.service_configs[0]
      : client.service_configs || {}

    console.log(`\n${index + 1}. ${client.name}`)
    console.log(`   Slug: ${client.slug}`)
    console.log(`   Email: ${client.contact_email}`)
    console.log(`   Industry: ${client.industry || 'N/A'}`)
    console.log(`   Services:`)
    console.log(`     - Google Analytics: ${config.ga_property_id ? '✅ ' + config.ga_property_id : '❌'}`)
    console.log(`     - Google Ads: ${config.gads_customer_id ? '✅ ' + config.gads_customer_id : '❌'}`)
    console.log(`     - GBP: ${config.gbp_location_id ? '✅ ' + config.gbp_location_id : '❌'}`)
    console.log(`     - Search Console: ${config.gsc_site_url ? '✅ ' + config.gsc_site_url : '❌'}`)
  })

  console.log('\n' + '='.repeat(80))
}

listClients()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

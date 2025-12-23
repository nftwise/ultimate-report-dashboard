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

// Mapping of client names to their correct GBP location IDs from the API response
const locationMapping: Record<string, string> = {
  'Hood Chiropractic': '12570443580620511972',
  'SoulScale': '7649549115808845934',
  'CorePosture Chiropractic': '1203151849529238982',
  'Integrity Chiropractic': '3490288298420524375',
  'Performance Health': '7385302836341091083',
  'Elevation Spine and Wellness': '11440715785645505385',
  'DeCarlo Chiropractic': '17196030318038468635',
  'Chiropractic First': '14672265684066117589',
  'Symmetry Health Center': '9047191745878789015',
  'Axis Chiropractic': '8187313869615072516'
}

async function mapAllGBPLocations() {
  console.log('🗺️  Mapping ALL GBP Location IDs for clients...\n')

  // Get all clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, slug')
    .eq('is_active', true)

  if (clientsError || !clients) {
    console.error('❌ Could not fetch clients:', clientsError)
    return
  }

  console.log(`Found ${clients.length} active clients\n`)

  let updated = 0
  let skipped = 0

  for (const client of clients) {
    // Try to find matching location by client name
    let locationId: string | null = null

    // Check if client name matches any GBP location title
    for (const [locationTitle, locId] of Object.entries(locationMapping)) {
      if (
        client.name.toLowerCase().includes(locationTitle.toLowerCase()) ||
        locationTitle.toLowerCase().includes(client.name.toLowerCase())
      ) {
        locationId = locId
        break
      }
    }

    if (locationId) {
      // Update the service_configs table
      const { error: updateError } = await supabase
        .from('service_configs')
        .update({ gbp_location_id: locationId })
        .eq('client_id', client.id)

      if (updateError) {
        console.log(`❌ ${client.name}: Failed to update - ${updateError.message}`)
      } else {
        console.log(`✅ ${client.name} → ${locationId}`)
        updated++
      }
    } else {
      console.log(`⏭️  ${client.name}: No matching GBP location found`)
      skipped++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✅ Updated: ${updated} clients`)
  console.log(`⏭️  Skipped: ${skipped} clients (no GBP location found)`)
  console.log(`${'='.repeat(60)}`)
}

mapAllGBPLocations()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

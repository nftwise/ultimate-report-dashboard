import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

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

// CSV data mapping (business_name -> city, state)
const clientCityData: Record<string, { city: string; state: string; owner?: string }> = {
  'DECARLO CHIROPRACTIC': { city: 'New City', state: 'NY', owner: 'Chris DeCarlo' },
  'CHIROSOLUTIONS CENTER': { city: 'Virginia Beach', state: 'VA', owner: 'Samantha Coleman' },
  'COREPOSTURE': { city: 'Newport Beach', state: 'CA', owner: 'Tyler Meier' },
  'ZEN CARE PHYSICAL MEDICINE': { city: 'Irvine', state: 'CA', owner: 'Jay Kang' },
  'WHOLE BODY WELLNESS': { city: 'Riverside', state: 'CA', owner: 'Daniel Mendez' },
  'TAILS ANIMAL CHIROPRACTIC CARE': { city: 'Fort Collins', state: 'CO', owner: 'Dr. Alisha Barnes' },
  'NEWPORT CENTER FAMILY CHIROPRACTIC': { city: 'Newport Beach', state: 'CA', owner: 'Mike Digrado' },
  'THE CHIROPRACTIC SOURCE': { city: 'Cedar Grove', state: 'NJ', owner: 'Dr. Marco Ferrucci' },
  'RESTORATION DENTAL': { city: 'Orange', state: 'CA', owner: 'Dr. Ronald Pham DDS' },
  'CHIROPRACTIC CARE CENTRE': { city: 'Tampa', state: 'FL', owner: 'Dr. Dean Brown' },
  'CHIROPRACTIC HEALTH CLUB': { city: 'Riverside', state: 'CA', owner: 'Dr. Jay Kang' },
  'CHIROPRACTIC FIRST': { city: 'Redding', state: 'CA', owner: 'Dr. Todd Royse' },
  'SOUTHPORT CHIROPRACTIC': { city: 'Fairfield', state: 'CT', owner: 'Dr. Richard Pinsky and Dr. Cathy Brodows' },
  'HAVEN CHIROPRACTIC': { city: 'Asheville', state: 'NC' },
  'REGENERATE CHIROPRACTIC': { city: 'Murrells Inlet', state: 'SC', owner: 'Dr. Matt Locke' },
  'TINKER FAMILY CHIRO': { city: 'Mt. Juliet', state: 'TN', owner: 'Dr. Brittany Tinker' },
  'CINQUE CHIROPRACTIC': { city: 'Schenectady', state: 'NY', owner: 'Dr. Alexa Cinque' },
  'AXIS CHIROPRACTIC': { city: 'Charleston', state: 'SC', owner: 'Dr. Lee Russo' },
  'HOOD CHIROPRACTIC': { city: 'St. Petersburg', state: 'FL', owner: 'Christopher Hood' },
  'FUNCTIONAL SPINE CHIROPRACTIC': { city: 'Tampa', state: 'FL', owner: 'Dr. Myanell Orta' }
}

async function importCitiesFromCSV() {
  console.log('📥 Importing city data from CSV...\n')
  console.log('='.repeat(80))

  // Get all clients from database
  const { data: allClients, error: fetchError } = await supabase
    .from('clients')
    .select('id, slug, name, city, owner')
    .eq('is_active', true)

  if (fetchError) {
    console.error('❌ Error fetching clients:', fetchError.message)
    return
  }

  console.log(`\n📊 Found ${allClients?.length || 0} active clients in database`)

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0

  for (const client of allClients || []) {
    // Skip if already has city
    if (client.city && client.city.trim() !== '') {
      console.log(`⏭️  Skipping ${client.name} - already has city: ${client.city}`)
      skippedCount++
      continue
    }

    // Look up city data by name
    const normalizedName = client.name.toUpperCase()
    const cityData = clientCityData[normalizedName]

    if (!cityData) {
      console.log(`❌ No city data found for: ${client.name} (${client.slug})`)
      notFoundCount++
      continue
    }

    // Update client with city data
    const cityString = `${cityData.city}, ${cityData.state}`
    const { error } = await supabase
      .from('clients')
      .update({
        city: cityString,
        owner: cityData.owner || client.owner || null
      })
      .eq('id', client.id)

    if (error) {
      console.log(`❌ Error updating ${client.name}: ${error.message}`)
    } else {
      console.log(`✅ Updated ${client.slug}: city="${cityString}"${cityData.owner ? `, owner="${cityData.owner}"` : ''}`)
      updatedCount++
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n📊 Import Results:')
  console.log(`   Updated: ${updatedCount} clients`)
  console.log(`   Skipped (already had city): ${skippedCount} clients`)
  console.log(`   Not found in CSV: ${notFoundCount} clients`)

  // Verify final status
  console.log('\n✅ Verifying final status...')

  const { data: finalClients } = await supabase
    .from('clients')
    .select('slug, name, city, owner')
    .eq('is_active', true)

  const withCity = finalClients?.filter(c => c.city && c.city.trim() !== '') || []
  const withoutCity = finalClients?.filter(c => !c.city || c.city.trim() === '') || []

  console.log(`\n   Total clients: ${finalClients?.length || 0}`)
  console.log(`   With city: ${withCity.length} (${Math.round(withCity.length / (finalClients?.length || 1) * 100)}%)`)
  console.log(`   Without city: ${withoutCity.length}`)

  if (withoutCity.length > 0) {
    console.log('\n   ⚠️  Still missing city data:')
    withoutCity.forEach(c => console.log(`      - ${c.slug}: ${c.name}`))
  } else {
    console.log('\n   🎉 All clients now have city data!')
  }

  console.log('\n✅ Import complete!\n')
}

importCitiesFromCSV()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Import failed:', err)
    process.exit(1)
  })

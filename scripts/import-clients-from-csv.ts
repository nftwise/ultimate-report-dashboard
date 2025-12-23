import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse/sync'
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

interface CSVClient {
  business_name: string
  city: string
  state: string
  zip: string
  business_type: string
  website_url: string
  phone: string
  email: string
  contact_person: string
  address: string
  google_business_url: string
  rating: string
  review_count: string
  hours: string
  service_area: string
  categories: string
  facebook_url: string
  instagram_url: string
  linkedin_url: string
  youtube_url: string
  yelp_url: string
  healthgrades_url: string
  avvo_url: string
  other_listings: string
  primary_keywords: string
  competitors: string
  seo_rating: string
  google_ads_rating: string
  ads_budget_month: string
  adwords_start_date: string
  service_pages_count: string
  has_blog: string
  last_audit_date: string
  audit_score: string
  notes: string
}

function createSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function parseGoogleMapsUrl(url: string): string | null {
  if (!url) return null

  // Try to extract location ID from various Google Maps URL formats
  const cidMatch = url.match(/cid=(\d+)/)
  if (cidMatch) return cidMatch[1]

  const placeMatch = url.match(/place\/([^\/]+)/)
  if (placeMatch) return placeMatch[1]

  return null
}

async function importClients() {
  console.log('📂 Reading CSV file...')

  const csvPath = '/Users/trieu/Desktop/VS CODE/GW Local SEO/clients.csv'
  const fileContent = fs.readFileSync(csvPath, 'utf-8')

  const records: CSVClient[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true // Allow rows with different column counts
  })

  console.log(`📊 Found ${records.length} clients in CSV\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const record of records) {
    try {
      const slug = createSlug(record.business_name)

      // Check if client already exists
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id, slug')
        .eq('slug', slug)
        .single()

      if (existingClient) {
        console.log(`⏭️  Skipping ${record.business_name} - already exists (${slug})`)
        skipped++
        continue
      }

      console.log(`\n🔄 Importing: ${record.business_name}`)

      // Generate a temporary password
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      // Create client - only use columns that exist in the table
      const cityState = `${record.city}, ${record.state}`
      const { data: client, error: clientError} = await supabase
        .from('clients')
        .insert({
          name: record.business_name,
          slug: slug,
          contact_email: record.email || `${slug}@temp.com`,
          contact_name: record.contact_person || '',
          contact_phone: record.phone || null,
          industry: record.business_type || 'chiropractor',
          city: cityState,
          owner: record.contact_person || null,
          is_active: true,
          plan_type: 'professional' // default plan
        })
        .select()
        .single()

      if (clientError) {
        console.error(`❌ Error creating client ${record.business_name}:`, clientError.message)
        errors++
        continue
      }

      console.log(`✅ Created client: ${client.name}`)
      console.log(`   Slug: ${slug}`)
      console.log(`   City: ${cityState}`)

      // Extract location ID from Google Business URL
      const gbpLocationId = parseGoogleMapsUrl(record.google_business_url)

      // Determine if they have Google Ads based on ratings
      const hasGoogleAds = record.google_ads_rating && parseInt(record.google_ads_rating) > 0
      const hasSEO = record.seo_rating && parseInt(record.seo_rating) > 0

      // Create service config - client_id is the UUID from clients.id
      const { error: configError } = await supabase
        .from('service_configs')
        .insert({
          client_id: client.id,
          ga_property_id: null,
          gads_customer_id: null,
          gads_manager_account_id: hasGoogleAds ? '8432700368' : null,
          gbp_location_id: gbpLocationId || null,
          gsc_site_url: record.website_url || null,
          callrail_account_id: null
        })

      if (configError) {
        console.error(`❌ Error creating service config:`, configError.message)
        errors++
        continue
      }

      console.log(`   📋 Service config created`)

      // Create user account for client login
      const { error: userError } = await supabase
        .from('users')
        .insert({
          email: record.email || `${slug}@temp.com`,
          password_hash: hashedPassword,
          role: 'client',
          client_id: client.id,
          is_active: true
        })

      if (userError) {
        console.log(`   ⚠️  Could not create user account: ${userError.message}`)
      } else {
        console.log(`   👤 User account created`)
      }

      console.log(`   📧 Email: ${record.email || `${slug}@temp.com`}`)
      console.log(`   🔑 Temp password: ${tempPassword}`)
      console.log(`   🌐 Website: ${record.website_url}`)
      console.log(`   📍 GBP Location: ${gbpLocationId || 'Not found'}`)
      console.log(`   💰 Ad Budget: ${record.ads_budget_month || 'N/A'}`)
      console.log(`   🎯 Services: ${hasSEO ? 'SEO' : ''} ${hasGoogleAds ? 'Google Ads' : ''} ${gbpLocationId ? 'GBP' : ''}`.trim())

      imported++

    } catch (error: any) {
      console.error(`❌ Error processing ${record.business_name}:`, error.message)
      errors++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Import Summary:')
  console.log(`✅ Imported: ${imported}`)
  console.log(`⏭️  Skipped (already exists): ${skipped}`)
  console.log(`❌ Errors: ${errors}`)
  console.log(`📋 Total: ${records.length}`)
  console.log('='.repeat(50))
}

// Run the import
importClients()
  .then(() => {
    console.log('\n✅ Import complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error)
    process.exit(1)
  })

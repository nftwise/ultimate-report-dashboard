import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// All 51 new columns to add
const newColumns = [
  // Traffic metrics (GA4)
  { name: 'sessions', type: 'INTEGER', default: 0 },
  { name: 'users', type: 'INTEGER', default: 0 },
  { name: 'new_users', type: 'INTEGER', default: 0 },
  { name: 'traffic_organic', type: 'INTEGER', default: 0 },
  { name: 'traffic_paid', type: 'INTEGER', default: 0 },
  { name: 'traffic_direct', type: 'INTEGER', default: 0 },
  { name: 'traffic_referral', type: 'INTEGER', default: 0 },
  { name: 'traffic_ai', type: 'INTEGER', default: 0 },
  { name: 'sessions_mobile', type: 'INTEGER', default: 0 },
  { name: 'sessions_desktop', type: 'INTEGER', default: 0 },

  // SEO / Search Console
  { name: 'seo_impressions', type: 'INTEGER', default: 0 },
  { name: 'seo_clicks', type: 'INTEGER', default: 0 },
  { name: 'seo_ctr', type: 'DECIMAL', default: 0 },
  { name: 'branded_traffic', type: 'INTEGER', default: 0 },
  { name: 'non_branded_traffic', type: 'INTEGER', default: 0 },
  { name: 'keywords_improved', type: 'INTEGER', default: 0 },
  { name: 'keywords_declined', type: 'INTEGER', default: 0 },

  // Google Ads Advanced
  { name: 'ads_impressions', type: 'INTEGER', default: 0 },
  { name: 'ads_clicks', type: 'INTEGER', default: 0 },
  { name: 'ads_ctr', type: 'DECIMAL', default: 0 },
  { name: 'ads_avg_cpc', type: 'DECIMAL', default: 0 },
  { name: 'ads_impression_share', type: 'DECIMAL', default: 0 },
  { name: 'ads_search_lost_budget', type: 'DECIMAL', default: 0 },
  { name: 'ads_quality_score', type: 'DECIMAL', default: 0 },
  { name: 'ads_conversion_rate', type: 'DECIMAL', default: 0 },
  { name: 'ads_top_impression_rate', type: 'DECIMAL', default: 0 },

  // GBP Performance
  { name: 'gbp_website_clicks', type: 'INTEGER', default: 0 },
  { name: 'gbp_directions', type: 'INTEGER', default: 0 },
  { name: 'gbp_profile_views', type: 'INTEGER', default: 0 },
  { name: 'gbp_searches_direct', type: 'INTEGER', default: 0 },
  { name: 'gbp_searches_discovery', type: 'INTEGER', default: 0 },

  // GBP Reviews & Engagement
  { name: 'gbp_reviews_count', type: 'INTEGER', default: 0 },
  { name: 'gbp_reviews_new', type: 'INTEGER', default: 0 },
  { name: 'gbp_rating_avg', type: 'DECIMAL', default: 0 },
  { name: 'gbp_q_and_a_count', type: 'INTEGER', default: 0 },
  { name: 'days_since_review', type: 'INTEGER', default: 0 },

  // GBP Content
  { name: 'gbp_photos_count', type: 'INTEGER', default: 0 },
  { name: 'gbp_posts_count', type: 'INTEGER', default: 0 },
  { name: 'gbp_posts_views', type: 'INTEGER', default: 0 },
  { name: 'gbp_posts_clicks', type: 'INTEGER', default: 0 },
  { name: 'days_since_post', type: 'INTEGER', default: 0 },

  // Account Manager
  { name: 'health_score', type: 'INTEGER', default: 0 },
  { name: 'mom_leads_change', type: 'DECIMAL', default: 0 },
  { name: 'alerts_count', type: 'INTEGER', default: 0 },
  { name: 'budget_utilization', type: 'DECIMAL', default: 0 },

  // Content & Engagement
  { name: 'top_landing_pages', type: 'JSONB', default: '[]' },
  { name: 'blog_sessions', type: 'INTEGER', default: 0 },
  { name: 'content_conversions', type: 'INTEGER', default: 0 },
  { name: 'engagement_rate', type: 'DECIMAL', default: 0 },
  { name: 'returning_users', type: 'INTEGER', default: 0 },
  { name: 'conversion_rate', type: 'DECIMAL', default: 0 },
]

async function checkExistingColumns() {
  // Get a sample row to see existing columns
  const { data, error } = await supabase
    .from('client_metrics_summary')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error checking columns:', error.message)
    return []
  }

  if (data && data.length > 0) {
    return Object.keys(data[0])
  }
  return []
}

async function runMigration() {
  console.log('🚀 Running migration: Add 51 new columns to client_metrics_summary\n')

  // Check existing columns
  const existingColumns = await checkExistingColumns()
  console.log(`📊 Existing columns: ${existingColumns.length}`)

  // Find columns that need to be added
  const columnsToAdd = newColumns.filter(col => !existingColumns.includes(col.name))
  console.log(`📝 Columns to add: ${columnsToAdd.length}\n`)

  if (columnsToAdd.length === 0) {
    console.log('✅ All columns already exist!')
    return
  }

  // Generate ALTER TABLE statements
  console.log('SQL statements to run in Supabase SQL Editor:\n')
  console.log('-- Copy and paste this into Supabase SQL Editor --\n')

  for (const col of columnsToAdd) {
    let sqlType = 'INTEGER'
    let defaultValue = '0'

    if (col.type === 'DECIMAL') {
      sqlType = 'DECIMAL(10,2)'
      defaultValue = '0'
    } else if (col.type === 'JSONB') {
      sqlType = 'JSONB'
      defaultValue = "'[]'"
    }

    console.log(`ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS ${col.name} ${sqlType} DEFAULT ${defaultValue};`)
  }

  console.log('\n-- End of SQL statements --\n')

  // Try to add columns via a workaround - insert a row with new fields
  console.log('Attempting to add columns programmatically...\n')

  // Create the full SQL
  const alterStatements = columnsToAdd.map(col => {
    let sqlType = 'INTEGER'
    let defaultValue = '0'
    if (col.type === 'DECIMAL') {
      sqlType = 'DECIMAL(10,2)'
      defaultValue = '0'
    } else if (col.type === 'JSONB') {
      sqlType = 'JSONB'
      defaultValue = "'[]'"
    }
    return `ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS ${col.name} ${sqlType} DEFAULT ${defaultValue}`
  }).join(';\n') + ';'

  // Write to a file for manual execution if needed
  const fs = require('fs')
  fs.writeFileSync('/tmp/add_columns.sql', alterStatements)
  console.log('📄 SQL saved to /tmp/add_columns.sql')

  // Try using Supabase's SQL function if available
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: alterStatements })
    })

    if (response.ok) {
      console.log('✅ Columns added successfully!')
    } else {
      console.log('⚠️ Could not add columns via API. Please run SQL manually in Supabase Dashboard.')
      console.log('\n📋 Steps:')
      console.log('1. Go to Supabase Dashboard → SQL Editor')
      console.log('2. Copy the SQL from /tmp/add_columns.sql')
      console.log('3. Run the SQL')
    }
  } catch (e) {
    console.log('⚠️ Please run the SQL manually in Supabase Dashboard.')
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

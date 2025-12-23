import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addColumns() {
  console.log('🚀 Adding 51 new columns to client_metrics_summary...\n')

  const columns = [
    // Traffic metrics (GA4)
    'sessions INTEGER DEFAULT 0',
    'users INTEGER DEFAULT 0',
    'new_users INTEGER DEFAULT 0',
    'traffic_organic INTEGER DEFAULT 0',
    'traffic_paid INTEGER DEFAULT 0',
    'traffic_direct INTEGER DEFAULT 0',
    'traffic_referral INTEGER DEFAULT 0',
    'traffic_ai INTEGER DEFAULT 0',
    'sessions_mobile INTEGER DEFAULT 0',
    'sessions_desktop INTEGER DEFAULT 0',

    // SEO / Search Console
    'seo_impressions INTEGER DEFAULT 0',
    'seo_clicks INTEGER DEFAULT 0',
    'seo_ctr DECIMAL(10,2) DEFAULT 0',
    'branded_traffic INTEGER DEFAULT 0',
    'non_branded_traffic INTEGER DEFAULT 0',
    'keywords_improved INTEGER DEFAULT 0',
    'keywords_declined INTEGER DEFAULT 0',

    // Google Ads Advanced
    'ads_impressions INTEGER DEFAULT 0',
    'ads_clicks INTEGER DEFAULT 0',
    'ads_ctr DECIMAL(10,2) DEFAULT 0',
    'ads_avg_cpc DECIMAL(10,2) DEFAULT 0',
    'ads_impression_share DECIMAL(10,2) DEFAULT 0',
    'ads_search_lost_budget DECIMAL(10,2) DEFAULT 0',
    'ads_quality_score DECIMAL(10,2) DEFAULT 0',
    'ads_conversion_rate DECIMAL(10,2) DEFAULT 0',
    'ads_top_impression_rate DECIMAL(10,2) DEFAULT 0',

    // GBP Performance
    'gbp_website_clicks INTEGER DEFAULT 0',
    'gbp_directions INTEGER DEFAULT 0',
    'gbp_profile_views INTEGER DEFAULT 0',
    'gbp_searches_direct INTEGER DEFAULT 0',
    'gbp_searches_discovery INTEGER DEFAULT 0',

    // GBP Reviews & Engagement
    'gbp_reviews_count INTEGER DEFAULT 0',
    'gbp_reviews_new INTEGER DEFAULT 0',
    'gbp_rating_avg DECIMAL(10,2) DEFAULT 0',
    'gbp_q_and_a_count INTEGER DEFAULT 0',
    'days_since_review INTEGER DEFAULT 0',

    // GBP Content
    'gbp_photos_count INTEGER DEFAULT 0',
    'gbp_posts_count INTEGER DEFAULT 0',
    'gbp_posts_views INTEGER DEFAULT 0',
    'gbp_posts_clicks INTEGER DEFAULT 0',
    'days_since_post INTEGER DEFAULT 0',

    // Account Manager
    'health_score INTEGER DEFAULT 0',
    'mom_leads_change DECIMAL(10,2) DEFAULT 0',
    'alerts_count INTEGER DEFAULT 0',
    'budget_utilization DECIMAL(10,2) DEFAULT 0',

    // Content & Engagement
    "top_landing_pages JSONB DEFAULT '[]'::jsonb",
    'blog_sessions INTEGER DEFAULT 0',
    'content_conversions INTEGER DEFAULT 0',
    'engagement_rate DECIMAL(10,2) DEFAULT 0',
    'returning_users INTEGER DEFAULT 0',
    'conversion_rate DECIMAL(10,2) DEFAULT 0',
  ]

  // Try using DATABASE_URL for direct connection
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL

  if (dbUrl) {
    console.log('✅ Found DATABASE_URL, using direct PostgreSQL connection...\n')

    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    })

    let added = 0
    let skipped = 0

    for (const col of columns) {
      const colName = col.split(' ')[0]
      const sql = `ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS ${col}`

      try {
        await pool.query(sql)
        console.log(`  ✅ ${colName}`)
        added++
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          console.log(`  ⏭️ ${colName} (exists)`)
          skipped++
        } else {
          console.log(`  ❌ ${colName}: ${e.message}`)
        }
      }
    }

    await pool.end()
    console.log(`\n✅ Done! Added: ${added}, Skipped: ${skipped}`)
    return
  }

  // Fallback: print SQL for manual execution
  console.log('⚠️ No DATABASE_URL found. Please run this SQL in Supabase Dashboard:\n')
  console.log('-- Copy everything below --\n')

  for (const col of columns) {
    console.log(`ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS ${col};`)
  }

  console.log('\n-- End of SQL --')
}

addColumns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })

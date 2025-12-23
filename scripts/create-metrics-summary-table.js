/**
 * Script to create client_metrics_summary table for pre-computed metrics
 * Run: node scripts/create-metrics-summary-table.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tupedninjtaarmdwppgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cGVkbmluanRhYXJtZHdwcGd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE2MzA1NCwiZXhwIjoyMDc2NzM5MDU0fQ.ulXb0ri8GGnXogfI08yGf-j8MaQsBRhd2ZUxyk470Vw'
);

async function createTable() {
  console.log('Creating client_metrics_summary table...');

  // Create the table using raw SQL via RPC
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS client_metrics_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        period_type VARCHAR(20) NOT NULL DEFAULT 'daily',

        -- Google Ads metrics
        google_ads_conversions INTEGER DEFAULT 0,
        ad_spend DECIMAL(10,2) DEFAULT 0,

        -- GA4 metrics
        form_fills INTEGER DEFAULT 0,

        -- Search Console metrics
        google_rank DECIMAL(4,1),
        top_keywords INTEGER DEFAULT 0,

        -- Calculated metrics
        total_leads INTEGER DEFAULT 0,
        cpl DECIMAL(10,2) DEFAULT 0,

        -- Metadata
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),

        -- Unique constraint
        UNIQUE(client_id, date, period_type)
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_summary_client_date ON client_metrics_summary(client_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_metrics_summary_date ON client_metrics_summary(date DESC);
    `
  });

  if (error) {
    console.log('RPC not available, trying alternative method...');

    // Try inserting a test record to see if table exists
    const { error: testError } = await supabase
      .from('client_metrics_summary')
      .select('id')
      .limit(1);

    if (testError && testError.code === '42P01') {
      console.log('Table does not exist. Please create it manually in Supabase dashboard:');
      console.log(`
-- Run this SQL in Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS client_metrics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL DEFAULT 'daily',

  -- Google Ads metrics
  google_ads_conversions INTEGER DEFAULT 0,
  ad_spend DECIMAL(10,2) DEFAULT 0,

  -- GA4 metrics
  form_fills INTEGER DEFAULT 0,

  -- Search Console metrics
  google_rank DECIMAL(4,1),
  top_keywords INTEGER DEFAULT 0,

  -- Calculated metrics
  total_leads INTEGER DEFAULT 0,
  cpl DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(client_id, date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_metrics_summary_client_date ON client_metrics_summary(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_summary_date ON client_metrics_summary(date DESC);

COMMENT ON TABLE client_metrics_summary IS 'Pre-computed daily metrics for fast admin dashboard';
      `);
    } else if (!testError) {
      console.log('Table already exists!');
    } else {
      console.error('Error:', testError);
    }
  } else {
    console.log('Table created successfully!');
  }
}

createTable();

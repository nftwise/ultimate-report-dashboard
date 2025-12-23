-- =============================================
-- Migration: Create client_metrics_summary table
-- Purpose: Pre-computed daily metrics for instant admin dashboard loading
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tupedninjtaarmdwppgy/sql
-- =============================================

-- Create table for pre-computed metrics
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

  -- GBP metrics
  gbp_calls INTEGER DEFAULT 0,

  -- Search Console metrics
  google_rank DECIMAL(4,1),
  top_keywords INTEGER DEFAULT 0,

  -- Calculated metrics
  total_leads INTEGER DEFAULT 0,
  cpl DECIMAL(10,2) DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one record per client per date per period
  UNIQUE(client_id, date, period_type)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_metrics_summary_client_date
  ON client_metrics_summary(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_summary_date
  ON client_metrics_summary(date DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_summary_period
  ON client_metrics_summary(period_type, date DESC);

-- Add comment for documentation
COMMENT ON TABLE client_metrics_summary IS 'Pre-computed daily/weekly/monthly metrics for fast admin dashboard loading. Updated by nightly rollup job.';

-- Enable RLS (Row Level Security)
ALTER TABLE client_metrics_summary ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON client_metrics_summary
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON client_metrics_summary TO service_role;
GRANT SELECT ON client_metrics_summary TO authenticated;

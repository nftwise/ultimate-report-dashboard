-- ============================================================
-- Supabase Row Level Security (RLS) - Enable & Configure
-- ============================================================
-- Purpose: Lock down database access so the anon key can only
--          SELECT from tables needed by the dashboard UI.
--          The service_role key (supabaseAdmin) always bypasses RLS.
--
-- Run this in: Supabase Dashboard → SQL Editor
-- Date: 2026-03-01
-- ============================================================

-- ============================================================
-- STEP 1: Enable RLS on ALL tables
-- ============================================================
-- Once enabled, default is DENY ALL for anon.
-- Only explicitly created policies will allow access.
-- service_role always bypasses RLS (no policy needed).

-- Core tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_metrics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;

-- GBP tables
ALTER TABLE gbp_location_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_location_photos ENABLE ROW LEVEL SECURITY;

-- Google Ads tables
ALTER TABLE ads_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_ad_group_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_conversion_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_search_terms ENABLE ROW LEVEL SECURITY;

-- GA4 tables
ALTER TABLE ga4_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ga4_landing_pages ENABLE ROW LEVEL SECURITY;

-- GSC tables
ALTER TABLE gsc_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_daily_summary ENABLE ROW LEVEL SECURITY;

-- GEO/Bing tables
ALTER TABLE bing_ai_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bing_ai_page_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bing_ai_queries ENABLE ROW LEVEL SECURITY;

-- Additional server-only tables (may or may not exist — skip if error)
ALTER TABLE ads_keyword_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_ad_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE bing_page_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE bing_news_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- SENSITIVE tables (NO policies = completely blocked for anon)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: SELECT policies for dashboard UI (anon key)
-- ============================================================
-- These 16 tables are queried from client-side pages using
-- the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY).
-- All operations are SELECT only.

-- Core tables (used in multiple dashboard pages)
CREATE POLICY "anon_select" ON clients
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON client_metrics_summary
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON service_configs
  FOR SELECT TO anon USING (true);

-- GBP tables (used in GBP page + overview)
CREATE POLICY "anon_select" ON gbp_location_daily_metrics
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON gbp_locations
  FOR SELECT TO anon USING (true);

-- Google Ads tables (used in Google Ads page)
CREATE POLICY "anon_select" ON ads_campaign_metrics
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON ads_ad_group_metrics
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON campaign_conversion_actions
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON campaign_search_terms
  FOR SELECT TO anon USING (true);

-- GA4 tables (used in SEO page + overview + cron-monitor)
CREATE POLICY "anon_select" ON ga4_sessions
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON ga4_events
  FOR SELECT TO anon USING (true);

-- GSC tables (used in SEO page + cron-monitor)
CREATE POLICY "anon_select" ON gsc_queries
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON gsc_daily_summary
  FOR SELECT TO anon USING (true);

-- Bing/GEO tables (used in GEO page)
CREATE POLICY "anon_select" ON bing_ai_citations
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON bing_ai_page_citations
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_select" ON bing_ai_queries
  FOR SELECT TO anon USING (true);

-- ============================================================
-- TABLES WITH NO ANON POLICIES (blocked for anon key):
-- ============================================================
-- SENSITIVE:
--   users              → has password_hash column!
--   system_settings    → has OAuth refresh tokens!
--
-- SERVER-ONLY (used by cron jobs/rollup via supabaseAdmin):
--   gbp_posts, gbp_location_photos  → empty tables
--   ga4_conversions, ga4_landing_pages → GA4 raw data
--   gsc_pages                        → GSC raw data
--   ads_keyword_metrics              → Ads keywords
--   google_ads_ad_performance        → Ads ad performance
--   bing_page_stats, bing_news_mentions → Bing sync data
--   api_cache                        → API response cache
--
-- All have RLS enabled but NO policies for anon,
-- so anon key gets zero access. Server-side code uses
-- supabaseAdmin (service_role) which always bypasses RLS.
-- ============================================================

-- ============================================================
-- VERIFICATION QUERIES (run after applying)
-- ============================================================
-- Check RLS is enabled on all tables:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- Check policies exist:
-- SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public';
--
-- Test anon access to sensitive tables (should return 0 rows):
-- SET ROLE anon;
-- SELECT count(*) FROM users;          -- should be 0
-- SELECT count(*) FROM system_settings; -- should be 0
-- RESET ROLE;
--
-- Test anon access to dashboard tables (should return rows):
-- SET ROLE anon;
-- SELECT count(*) FROM clients;         -- should be ~25
-- SELECT count(*) FROM client_metrics_summary; -- should be ~9600+
-- RESET ROLE;

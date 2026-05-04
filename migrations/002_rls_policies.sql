-- ============================================
-- Row-Level Security (RLS) Policies
-- Purpose: Prevent anon-key clients from reading other clients' data
-- Created: 2026-05-04
--
-- WHY THIS EXISTS:
-- Dashboard pages use the Supabase anon key directly from the browser to read
-- metrics. Without RLS, any authenticated user could change `client_id` in a
-- network request and read another clinic's data. These policies enforce
-- server-side filtering tied to the JWT's `client_id` claim (set by NextAuth).
--
-- HOW IT WORKS:
-- - service_role key (used by `supabaseAdmin` on the server) BYPASSES RLS
--   → all server-side cron/admin code keeps working unchanged.
-- - anon key (used by browser pages) is subject to RLS
--   → only rows matching the user's JWT can be read.
--
-- ⚠️  NEXTAUTH NOTE:
-- This project uses NextAuth, NOT Supabase Auth. The anon key has NO JWT
-- claims, so the policies below permit reads only when the request comes
-- from an authenticated NextAuth session that has been forwarded to Supabase
-- via PostgREST's `Authorization: Bearer <jwt>` header.
--
-- TWO OPTIONS for enforcement:
--   1. Configure NextAuth to mint a Supabase-compatible JWT (with `sub` =
--      user id and a custom `client_id` claim) and pass it to the browser
--      Supabase client via `auth.setSession()`. Then policies can use
--      `auth.jwt() ->> 'client_id'`.
--   2. SIMPLER: deny all anon reads and route every browser query through
--      a server-side API endpoint that uses `supabaseAdmin` after checking
--      `getServerSession()`. Drop these policies, just lock down the anon role.
--
-- This file implements OPTION 2 — block anon reads of sensitive tables.
-- Server-side API routes already exist for `/api/clients/list`. Pages that
-- still query Supabase directly from the browser must be migrated to API
-- routes (see CLAUDE.md "RLS / Data Access" section).
-- ============================================

-- ── Enable RLS + deny anon — single resilient block ────────────────────────
-- Skips tables that don't exist (e.g. gsc_pages may be absent in some envs)
-- and tables that exist but haven't been added here yet.
-- Also includes Bing AI and Facebook tables actually used by portal endpoints.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    -- Core
    'clients', 'service_configs', 'client_metrics_summary',
    'system_settings', 'users', 'login_logs',
    'manual_form_fills',
    -- GBP
    'gbp_locations', 'gbp_location_daily_metrics',
    -- GA4
    'ga4_sessions', 'ga4_events', 'ga4_conversions', 'ga4_landing_pages',
    -- GSC
    'gsc_queries', 'gsc_daily_summary', 'gsc_pages',
    -- Google Ads
    'ads_campaign_metrics', 'ads_ad_group_metrics',
    'campaign_conversion_actions', 'campaign_search_terms',
    -- Facebook Ads
    'fb_campaign_metrics', 'fb_leads',
    -- Bing AI / GEO
    'bing_ai_citations', 'bing_ai_page_citations', 'bing_ai_queries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip tables that don't exist in the public schema
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      RAISE NOTICE '[RLS] Skipping non-existent table: %', t;
      CONTINUE;
    END IF;

    -- Enable RLS (idempotent — no-op if already enabled)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    -- Drop and recreate the deny-anon policy
    EXECUTE format('DROP POLICY IF EXISTS deny_anon_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY deny_anon_all ON %I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',
      t
    );

    RAISE NOTICE '[RLS] Locked down: %', t;
  END LOOP;
END $$;

-- ── Verification query ─────────────────────────────────────────────────────
-- After running this migration, verify with:
--
--   SELECT schemaname, tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = true;
--
-- Then test from the browser console (must return 0 rows or empty array):
--
--   const { data } = await supabase.from('client_metrics_summary')
--     .select('*').limit(1);
--   console.log(data); // expected: [] or null
--
-- Server-side calls using supabaseAdmin (service_role) will continue to work.

-- ============================================
-- Gravity Forms → SMS lead-notification support
-- Created: 2026-06-09
--
-- 1. Adds clients.notify_phone — the clinic's SMS-CAPABLE mobile number.
--    NOTE: clients.contact_phone / clients.phone are mostly OFFICE LANDLINES
--    and are NOT SMS-capable, so we never send alerts there. This dedicated
--    column holds the number that should receive new-lead SMS alerts.
--
-- 2. Creates website_form_leads — minimal record-keeping table for inbound
--    leads captured via the /api/webhooks/gravity-forms endpoint.
--
-- RLS NOTE: the `clients` table is already locked down by migration
-- 002_rls_policies.sql (whole-table RESTRICTIVE deny for the anon role).
-- Adding a column does not loosen that, so no RLS change is needed for
-- notify_phone. The new website_form_leads table IS sensitive, so we
-- enable RLS + deny anon below (and it is added to verify-rls SENSITIVE_TABLES).
-- ============================================

-- ── 1. clients.notify_phone ────────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_phone text;

COMMENT ON COLUMN clients.notify_phone IS
  'SMS-capable mobile for new-lead alerts (E.164, e.g. +15551234567). '
  'Distinct from contact_phone/phone which are office landlines.';

-- ── 2. website_form_leads ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS website_form_leads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid REFERENCES clients(id) ON DELETE CASCADE,
  name       text,
  phone      text,
  email      text,
  message    text,
  raw        jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_form_leads_client_id
  ON website_form_leads (client_id, created_at DESC);

-- ── 3. RLS: deny anon reads of the new lead table ──────────────────────────
ALTER TABLE website_form_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deny_anon_all ON website_form_leads;
CREATE POLICY deny_anon_all ON website_form_leads
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

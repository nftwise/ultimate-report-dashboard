-- ─── fb_campaign_metrics ────────────────────────────────────
-- Stores daily Facebook Ads campaign metrics per client.
-- Conflict key: (client_id, date, campaign_id)

CREATE TABLE IF NOT EXISTS fb_campaign_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  campaign_id   TEXT NOT NULL,
  campaign_name TEXT,
  adset_id      TEXT,
  adset_name    TEXT,
  spend         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  impressions   INTEGER NOT NULL DEFAULT 0,
  clicks        INTEGER NOT NULL DEFAULT 0,
  reach         INTEGER NOT NULL DEFAULT 0,
  leads         INTEGER NOT NULL DEFAULT 0,
  messages      INTEGER NOT NULL DEFAULT 0,
  calls         INTEGER NOT NULL DEFAULT 0,
  cpl           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ctr           NUMERIC(10, 6) NOT NULL DEFAULT 0,
  cpc           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (client_id, date, campaign_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fb_campaign_metrics_client_date
  ON fb_campaign_metrics(client_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_fb_campaign_metrics_campaign
  ON fb_campaign_metrics(campaign_id);

-- ─── service_configs: add fb_ad_account_id column ─────────
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS fb_ad_account_id TEXT;

-- ─── client_metrics_summary: add FB aggregate columns ─────
ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS fb_spend       NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS fb_leads       INTEGER DEFAULT 0;
ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS fb_impressions INTEGER DEFAULT 0;
ALTER TABLE client_metrics_summary ADD COLUMN IF NOT EXISTS fb_clicks      INTEGER DEFAULT 0;

-- ─── CorePosture: set FB ad account ID ────────────────────
UPDATE service_configs
SET fb_ad_account_id = '120238332209530152'
WHERE client_id = '3c80f930-5f4d-49d6-9428-f2440e496aac';

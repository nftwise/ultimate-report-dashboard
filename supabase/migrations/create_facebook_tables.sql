-- ─── fb_leads ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fb_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_source       TEXT NOT NULL CHECK (lead_source IN ('fb_lead_ad','messenger','website_form','missed_call','manual')),
  fb_lead_id        TEXT,
  name              TEXT,
  phone             TEXT NOT NULL,
  email             TEXT,
  ad_name           TEXT,
  campaign_name     TEXT,
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','responded','converted')),
  notes             TEXT,
  last_contacted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, phone),
  UNIQUE (client_id, fb_lead_id)
);

-- ─── sms_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES fb_leads(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  direction   TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  body        TEXT NOT NULL,
  twilio_sid  TEXT,
  status      TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','received','failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── follow_up_sequences ───────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_up_sequences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  steps      JSONB NOT NULL DEFAULT '[]',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── lead_follow_up_state ──────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_follow_up_state (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES fb_leads(id) ON DELETE CASCADE,
  sequence_id      UUID NOT NULL REFERENCES follow_up_sequences(id) ON DELETE CASCADE,
  current_step     INTEGER NOT NULL DEFAULT 0,
  next_follow_up_at TIMESTAMPTZ NOT NULL,
  completed        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, sequence_id)
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fb_leads_client_id ON fb_leads(client_id);
CREATE INDEX IF NOT EXISTS idx_fb_leads_phone ON fb_leads(phone);
CREATE INDEX IF NOT EXISTS idx_fb_leads_status ON fb_leads(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_lead_id ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_follow_up_next ON lead_follow_up_state(next_follow_up_at) WHERE completed = false;

-- ─── service_configs: add FB columns if not exists ─────────
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS fb_page_id TEXT;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS fb_page_access_token TEXT;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS fb_sheet_id TEXT;
ALTER TABLE service_configs ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;

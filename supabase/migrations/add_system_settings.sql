-- System settings table for storing OAuth tokens and other config
-- This allows the app to work on Vercel serverless (no local files)

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Add comment
COMMENT ON TABLE system_settings IS 'Stores system-wide settings like OAuth tokens';

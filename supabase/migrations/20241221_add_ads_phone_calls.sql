-- Add ads_phone_calls column to track Google Ads phone call conversions
ALTER TABLE client_metrics_summary
ADD COLUMN IF NOT EXISTS ads_phone_calls INTEGER DEFAULT 0;

-- Add index for querying phone calls
CREATE INDEX IF NOT EXISTS idx_client_metrics_phone_calls ON client_metrics_summary(ads_phone_calls);

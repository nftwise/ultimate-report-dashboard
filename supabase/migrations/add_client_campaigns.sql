-- Create client_campaigns table to store Google Ads campaign-level data
CREATE TABLE IF NOT EXISTS client_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  cost_per_conversion DECIMAL(10,2) DEFAULT 0,
  search_impression_share DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, date, campaign_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_campaigns_client_date ON client_campaigns(client_id, date);
CREATE INDEX IF NOT EXISTS idx_client_campaigns_status ON client_campaigns(status);

-- Enable RLS
ALTER TABLE client_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS policies (same as client_metrics_summary)
CREATE POLICY "Service role can manage all campaigns" ON client_campaigns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their client campaigns" ON client_campaigns
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );

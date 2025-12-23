-- Create oauth_tokens table to store OAuth refresh tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expiry BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, service_name)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_service
ON oauth_tokens(client_id, service_name);

-- Add RLS policies
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to oauth_tokens"
ON oauth_tokens FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

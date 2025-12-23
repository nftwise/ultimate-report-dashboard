import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupOAuthTokensTable() {
  console.log('🚀 Setting up oauth_tokens table...\n');

  try {
    // Create the table using raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
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

        CREATE INDEX IF NOT EXISTS idx_oauth_tokens_client_service
        ON oauth_tokens(client_id, service_name);

        ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Allow service role full access to oauth_tokens" ON oauth_tokens;

        CREATE POLICY "Allow service role full access to oauth_tokens"
        ON oauth_tokens FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
      `
    });

    if (error) {
      console.error('❌ Error creating table:', error);
      process.exit(1);
    }

    console.log('✅ oauth_tokens table created successfully!');

  } catch (error: any) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupOAuthTokensTable();

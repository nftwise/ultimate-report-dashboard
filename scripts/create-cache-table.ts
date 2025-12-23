import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createCacheTable() {
  console.log('🔄 Creating api_cache table in Supabase...\n');

  const sql = `
    -- Create api_cache table
    CREATE TABLE IF NOT EXISTS api_cache (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cache_key VARCHAR(255) UNIQUE NOT NULL,
      data JSONB NOT NULL,
      source VARCHAR(50),
      client_id UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      ttl_seconds INTEGER,
      hit_count INTEGER DEFAULT 0,
      last_accessed_at TIMESTAMP DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_api_cache_key ON api_cache(cache_key);
    CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_api_cache_source ON api_cache(source);
  `;

  console.log('📝 SQL to execute:');
  console.log('----------------------------------------');
  console.log(sql);
  console.log('----------------------------------------\n');

  console.log('⚠️  Please run this SQL manually:');
  console.log('1. Go to: https://supabase.com/dashboard/project/tupedninjtaarmdwppgy/sql/new');
  console.log('2. Copy the SQL above');
  console.log('3. Paste and click "Run"\n');

  console.log('✅ After running the SQL, the cache system will be ready!\n');

  // Try to verify if table exists (this will fail if not created yet)
  try {
    const { count, error } = await supabase
      .from('api_cache')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log('❌ Table not found. Please create it using the SQL above.\n');
    } else {
      console.log(`✅ Table already exists! Current row count: ${count}\n`);
    }
  } catch (e) {
    console.log('❌ Could not verify table. Please create it manually.\n');
  }
}

createCacheTable();

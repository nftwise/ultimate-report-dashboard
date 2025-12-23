import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  try {
    console.log('🔄 Running database migration...');

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '001_create_api_cache.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing...`);

      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

      if (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error);
        // Continue with next statement
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log('\n📊 Verifying table creation...');

    // Verify the table exists
    const { data, error } = await supabase
      .from('api_cache')
      .select('count')
      .limit(1);

    if (error) {
      console.error('⚠️  Table verification failed:', error.message);
      console.log('\n📝 Please run the migration SQL manually in Supabase SQL Editor:');
      console.log('   1. Go to https://supabase.com/dashboard');
      console.log('   2. Select your project');
      console.log('   3. Go to SQL Editor');
      console.log('   4. Copy and paste the SQL from migrations/001_create_api_cache.sql');
    } else {
      console.log('✅ Table api_cache created successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

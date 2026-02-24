import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testConnection() {
    console.log('🔗 Testing Supabase Connection...');
    const { data, error } = await supabase.from('clients').select('count', { count: 'exact', head: true });

    if (error) {
        console.error('❌ Connection Failed:', error.message);
        process.exit(1);
    }

    console.log('✅ Connection Successful. Client count:', data);
    process.exit(0);
}

testConnection();

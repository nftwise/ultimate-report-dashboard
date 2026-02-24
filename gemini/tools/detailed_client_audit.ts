import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runAudit() {
    console.log('🚀 Starting Detailed Client Data Audit...\n');

    // 1. Get all active clients
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, slug')
        .eq('is_active', true);

    if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        return;
    }

    console.log(`📊 Found ${clients.length} active clients.\n`);

    const tables = [
        { name: 'client_metrics_summary', dateCol: 'date' },
        { name: 'ads_campaign_metrics', dateCol: 'date' },
        { name: 'ga4_sessions', dateCol: 'date' },
        { name: 'gbp_location_daily_metrics', dateCol: 'date' },
        { name: 'gsc_queries', dateCol: 'date' }
    ];

    for (const client of clients) {
        console.log(`--- [${client.slug}] ${client.name} ---`);

        for (const table of tables) {
            try {
                // Get count
                const { count, error: countError } = await supabase
                    .from(table.name)
                    .select('*', { count: 'exact', head: true })
                    .eq('client_id', client.id);

                if (countError) {
                    console.log(`  ❌ ${table.name}: Error - ${countError.message}`);
                    continue;
                }

                if (count === 0 || count === null) {
                    console.log(`  ⚠️  ${table.name}: 0 records`);
                    continue;
                }

                // Get min/max date
                // Note: Supabase JS doesn't have min/max aggregate functions directly in select, 
                // so we sort and take 1.
                const { data: minData } = await supabase
                    .from(table.name)
                    .select(table.dateCol)
                    .eq('client_id', client.id)
                    .order(table.dateCol, { ascending: true })
                    .limit(1);

                const { data: maxData } = await supabase
                    .from(table.name)
                    .select(table.dateCol)
                    .eq('client_id', client.id)
                    .order(table.dateCol, { ascending: false })
                    .limit(1);

                const minDate = (minData?.[0] as any)?.[table.dateCol] || 'N/A';
                const maxDate = (maxData?.[0] as any)?.[table.dateCol] || 'N/A';

                console.log(`  ✅ ${table.name.padEnd(26)}: ${String(count).padStart(6)} records | ${minDate} to ${maxDate}`);
            } catch (err: any) {
                console.log(`  ❌ ${table.name}: Unexpected Error - ${err.message}`);
            }
        }
        console.log('');
    }

    console.log('✨ Audit Complete!');
}

runAudit();

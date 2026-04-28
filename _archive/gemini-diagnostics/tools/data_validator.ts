import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyData() {
    const dateStr = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`🧐 [Data Guard] Verifying data for ${dateStr}...`);

    const { data, error } = await supabase
        .from('client_metrics_summary')
        .select('client_id, google_ads_conversions, ad_spend, form_fills, total_leads, cpl')
        .eq('date', dateStr);

    if (error) {
        console.error('❌ Query Failed:', error.message);
        process.exit(1);
    }

    console.log(`📊 Found ${data.length} records.`);
    console.table(data.slice(0, 10)); // Show first 10 for spot check

    const totalSpend = data.reduce((sum, r) => sum + (r.ad_spend || 0), 0);
    const totalLeads = data.reduce((sum, r) => sum + (r.total_leads || 0), 0);

    console.log(`💰 Total Spend: $${totalSpend.toFixed(2)}`);
    console.log(`🎯 Total Leads: ${totalLeads}`);
    console.log(`🎯 Average CPL: $${totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00'}`);

    process.exit(0);
}

verifyData();

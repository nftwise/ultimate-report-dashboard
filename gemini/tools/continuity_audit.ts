import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runContinuityAudit() {
    console.log('🚀 Starting CONTINUITY (Gap Detection) Audit...\n');

    const { data: clients } = await supabase
        .from('clients')
        .select('id, slug, name')
        .eq('is_active', true);

    if (!clients) return;

    const tables = [
        { name: 'Google Ads', table: 'ads_campaign_metrics' },
        { name: 'GA4', table: 'ga4_sessions' },
        { name: 'GBP', table: 'gbp_location_daily_metrics' }
    ];

    console.log('| Client | Source | Start | End | Expected Days | Actual Days | MISSING DAYS |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    for (const client of clients) {
        for (const source of tables) {
            // Get min, max and count of distinct days
            const { data: stats, error } = await supabase
                .from(source.table)
                .select('date')
                .eq('client_id', client.id);

            if (error || !stats || stats.length === 0) continue;

            const dates = stats.map(r => r.date).sort();
            const firstDate = new Date(dates[0]);
            const lastDate = new Date(dates[dates.length - 1]);

            const distinctDates = new Set(dates).size;

            const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
            const expectedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const missingDays = expectedDays - distinctDates;

            if (missingDays > 0) {
                console.log(`| ${client.slug} | ${source.name} | ${dates[0]} | ${dates[dates.length - 1]} | ${expectedDays} | ${distinctDates} | 🔴 **${missingDays}** |`);
            } else {
                console.log(`| ${client.slug} | ${source.name} | ${dates[0]} | ${dates[dates.length - 1]} | ${expectedDays} | ${distinctDates} | ✅ 0 |`);
            }
        }
        console.log('| --- | --- | --- | --- | --- | --- | --- |');
    }

    console.log('\n✨ Continuity Audit Complete!');
}

runContinuityAudit();
